step_log() {
  message=$1
  printf "\n\033[90;1m==> \033[0m\033[37;1m%s\033[0m\n" "$message"
}

add_log() {
  mark=$1
  shift
  subjects=("$@")
  for subject in "${subjects[@]}"; do
    if [ "$mark" = "$tick" ]; then
      printf "\033[32;1m%s \033[0m\033[34;1m%s \033[0m\033[90;1m%s\033[0m\n" "$mark" "$subject" "Added $subject"
    else
      printf "\033[31;1m%s \033[0m\033[34;1m%s \033[0m\033[90;1m%s\033[0m\n" "$mark" "$subject" "Failed to setup $subject"
    fi
  done
}

fix_ownership() {
  dir=$1
  sudo chown -R "$USER":"$(id -g -n)" "$(dirname "$dir")"
}

link_apt_fast() {
  if ! command -v apt-fast >/dev/null; then
    sudo ln -sf /usr/bin/apt-get /usr/bin/apt-fast
  fi
}

fetch_package() {
  if ! [ -e /tmp/Packages ]; then
    deb_build_arch=$(dpkg-architecture -q DEB_BUILD_ARCH)
    curl -o /tmp/Packages.gz -sL "http://ppa.launchpad.net/ondrej/php/ubuntu/dists/$DISTRIB_CODENAME/main/binary-$deb_build_arch/Packages.gz"
    gzip -df /tmp/Packages.gz
  fi
}

get_dependencies() {
  package=$1
  prefix=$2
  sed -e '/Package:\s'"$package$"'/,/^\s*$/!d' /tmp/Packages | grep -Eo "^Depends.*" | tr ',' '\n' | awk -v ORS='' '/^\s'"$prefix"'/{print$0}' | sed -e 's/([^()]*)//g' | sort | uniq | xargs echo -n
}

get_package_link() {
  package=$1
  trunk="http://ppa.launchpad.net/ondrej/php/ubuntu"
  file=$(sed -e '/Package:\s'"$package$"'/,/^\s*$/!d' /tmp/Packages | grep -Eo "^Filename.*" | cut -d' ' -f 2 | tr -d '\r')
  echo "$trunk/$file"
}

linux_extension_dir() {
  api_version=$1
  if [[ "$version" =~ $old_versions ]]; then
    echo "/usr/lib/php5/$api_version"
  elif [[ "$version" =~ 5.3|$nightly_versions ]]; then
    echo "/usr/local/php/$version/lib/php/extensions/no-debug-non-zts-$api_version"
  else
    echo "/usr/lib/php/$api_version"
  fi
}

darwin_extension_dir() {
  api_version=$1
  old_versions_darwin="5.[3-5]"
  if [[ "$version" =~ $old_versions_darwin ]]; then
    echo "/opt/local/lib/php${version/./}/extensions/no-debug-non-zts-$api_version"
  else
    if [[ "$(sysctl -n hw.optional.arm64 2>/dev/null)" == "1" ]]; then
      echo "/opt/homebrew/lib/php/pecl/$api_version"
    else
      echo "/usr/local/lib/php/pecl/$api_version"
    fi
  fi
}

get_api_version() {
  case $version in
  5.3) echo "20090626" ;;
  5.4) echo "20100525" ;;
  5.5) echo "20121212" ;;
  5.6) echo "20131226" ;;
  7.0) echo "20151012" ;;
  7.1) echo "20160303" ;;
  7.2) echo "20170718" ;;
  7.3) echo "20180731" ;;
  7.4) echo "20190902" ;;
  8.0) echo "20200930" ;;
  *)
    php_header="https://raw.githubusercontent.com/php/php-src/master/main/php.h"
    curl -sSL --retry 5 "$php_header" | grep "PHP_API_VERSION" | cut -d' ' -f 3
    ;;
  esac
}

add_config() {
  dependent_extension=$1
  dependency_extension=$2
  echo "$dependency_extension" | sudo tee "$cache_directory/$dependent_extension/$dependency_extension" >/dev/null 2>&1
}

setup_extension() {
  dependent_extension=$1
  dependency_extension=$2
  extension_dir=$3
  if ! [ -e "$extension_dir/$dependency_extension.so" ]; then
    extension_package_link="$(get_package_link "php$version-$dependency_extension")"
    sudo curl -H "User-Agent: Debian APT-HTTP/GHA(ce)" -o "$dependency_extension".deb -sL "$extension_package_link"
    sudo dpkg-deb -x "$dependency_extension".deb /
    fix_ownership "$dir"
  fi
  if [ -e "$extension_dir/$dependency_extension.so" ]; then
    add_config "$dependent_extension" "$dependency_extension"
    add_log "$tick" "$dependency_extension"
  else
    add_log "$cross" "$dependency_extension"
  fi
}

filter_dependencies_libs() {  
  libraries="$(echo "$1" | xargs -n1 | uniq | xargs)"
  script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )
  for library in $libraries; do
    if grep -i -q -w "$library" "$script_dir"/lists/"$DISTRIB_CODENAME"-libs; then
      libraries=${libraries//$library/}
    fi
  done
  echo "$libraries"
}

setup_dependencies_libs() {
  libraries=$1
  if [[ -n "${libraries// }" ]]; then
    libraries=$(filter_dependencies_libs "$libraries")
    if [[ -n "${libraries// }" ]]; then
      step_log "Setup libraries"
      IFS=' ' read -r -a libraries_array <<<"$libraries"
      link_apt_fast
      (
        sudo DEBIAN_FRONTEND=noninteractive apt-fast install --no-install-recommends --no-upgrade -y "${libraries_array[@]}" >/dev/null 2>&1 &&
        add_log "$tick" "${libraries_array[@]}"
      ) || add_log "$cross" "${libraries_array[@]}"
    fi
  fi
}

setup_dependencies_extensions() {
  extension_dir=$1
  shift
  extensions_array=("$@")
  . /etc/lsb-release
  cache_directory=/tmp/extcache
  sudo rm -rf "$cache_directory" || true
  libraries=""
  for extension_package in "${extensions_array[@]}"; do
    fetch_package
    libraries="$libraries $(get_dependencies "$extension_package" "lib")"
    extension="${extension_package/php$version-/}"
    if ! [ -d "$cache_directory"/"$extension" ]; then
      extension_dependencies=$(get_dependencies "$extension_package" "php$version-")
      extension_dependencies="${extension_dependencies//php$version-common/}"
      if [[ -n "${extension_dependencies// }" ]]; then
        step_log "Setup extensions for $extension"
        extension_dependencies_array=()
        IFS=' ' read -r -a extension_dependencies_array <<<"$extension_dependencies"
        sudo mkdir -p "$cache_directory"/"$extension"
        (
          cd "$cache_directory" || exit 1
          to_wait=()
          for extension_dependeny_package in "${extension_dependencies_array[@]}"; do
            if [[ -n "${extension_dependeny_package// }" ]]; then
              extension_dependency=${extension_dependeny_package/php$version-/}
              setup_extension "$extension" "$extension_dependency" "$extension_dir" &
              to_wait+=($!)
            fi
          done
          wait "${to_wait[@]}"
        )
      fi
    fi
  done
  setup_dependencies_libs "$libraries"
}

setup_dependencies() {
  extensions=$1
  extension_dir=$2
  if [[ -n "${extensions// }" ]]; then
    IFS=' ' read -r -a extensions_array <<<"$(echo "$extensions" | sed -e "s/pdo[_-]//g" -Ee "s/^|,\s*/ php$version-/g")"
    setup_dependencies_extensions "$extension_dir" "${extensions_array[@]}"
  fi
}

extensions=$1
key=$2
version=$3
tick="✓"
cross="✗"
os=$(uname -s)
old_versions="5.[4-5]"
nightly_versions="8.[1-9]"
if [ "$os" = "Linux" ]; then
  . /etc/lsb-release
  os=$os-$DISTRIB_CODENAME
  api_version=$(get_api_version)
  dir=$(linux_extension_dir "$api_version")
  sudo mkdir -p "$dir" && fix_ownership "$dir"
  setup_dependencies "$extensions" "$dir"
elif [ "$os" = "Darwin" ]; then
  api_version=$(get_api_version)
  dir=$(darwin_extension_dir "$api_version")
  sudo mkdir -p "$dir" && fix_ownership "$dir"
else
  os="Windows"
  dir='C:\\tools\\php\\ext'
fi
key="$os"-ext-"$version"-$(echo -n "$extensions-$key" | openssl dgst -sha256 | cut -d ' ' -f 2)
key="$key-20210313"
echo "::set-output name=dir::$dir"
echo "::set-output name=key::$key"
