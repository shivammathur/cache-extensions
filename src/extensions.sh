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

# Function to backup and cleanup package lists.
cleanup_lists() {
  if [ ! -e /etc/apt/sources.list.d.save ]; then
    sudo mv /etc/apt/sources.list.d /etc/apt/sources.list.d.save
    sudo mkdir /etc/apt/sources.list.d
    sudo mv /etc/apt/sources.list.d.save/*ondrej*.list /etc/apt/sources.list.d/
    trap "sudo mv /etc/apt/sources.list.d.save/*.list /etc/apt/sources.list.d/ 2>/dev/null" exit
  fi
}

# Function to add ppa:ondrej/php.
add_ppa() {
  if ! apt-cache policy | grep -q "ondrej/php"; then
    cleanup_lists
    LC_ALL=C.UTF-8 sudo apt-add-repository ppa:ondrej/php -y
    if [ "$DISTRIB_RELEASE" = "16.04" ]; then
      sudo DEBIAN_FRONTEND=noninteractive apt-get update
    fi
  fi
}

# Function to update the package lists.
update_lists() {
  if [ ! -e /tmp/setup_php ]; then
    [ "$DISTRIB_RELEASE" = "20.04" ] && add_ppa ondrej/php >/dev/null 2>&1
    cleanup_lists
    sudo DEBIAN_FRONTEND=noninteractive apt-get update >/dev/null 2>&1
    echo '' | sudo tee /tmp/setup_php >/dev/null 2>&1
  fi
}

linux_extension_dir() {
  apiv=$1
  if [[ "$version" =~ $old_versions ]]; then
    echo "/usr/lib/php5/$apiv"
  elif [[ "$version" =~ 5.3|$nightly_versions ]]; then
    echo "/usr/local/php/$version/lib/php/extensions/no-debug-non-zts-$apiv"
  else
    echo "/usr/lib/php/$apiv"
  fi
}

darwin_extension_dir() {
  apiv=$1
  old_versions_darwin="5.[3-5]"
  if [[ "$version" =~ $old_versions_darwin ]]; then
    echo "/opt/local/lib/php${version/./}/extensions/no-debug-non-zts-$apiv"
  else
    if [[ "$(sysctl -n hw.optional.arm64 2>/dev/null)" == "1" ]]; then
      echo "/opt/homebrew/lib/php/pecl/$apiv"
    else
      echo "/usr/local/lib/php/pecl/$apiv"
    fi
  fi
}

get_apiv() {
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
    php_h="https://raw.githubusercontent.com/php/php-src/master/main/php.h"
    curl -sSL --retry 5 "$php_h" | grep "PHP_API_VERSION" | cut -d' ' -f 3
    ;;
  esac
}

add_config() {
  local ext_name=$1
  local dep_ext_name=$2
  echo "$ext_name" | sudo tee "/tmp/extcache/$dep_ext_name/$ext_name" >/dev/null 2>&1
}

setup_extension() {
  local ext_name=$1
  local dep_ext_name=$2
  local ext_dir=$3
  if ! [ -e "$ext_dir/$ext_name.so" ]; then
    sudo dpkg-deb -R ./*"$ext_name"*.deb "$ext_name"
    find "$ext_name" -name "*.so" -exec cp {} "$ext_dir" \;
    sudo rm -rf "$ext_name"
    if [ -e "$ext_dir/$ext_name.so" ]; then
      add_config "$ext_name" "$dep_ext_name"
    fi
  else
    add_config "$ext_name" "$dep_ext_name"
  fi
}

setup_dependencies_extensions() {
  ext_dir=$1
  shift
  ext_array=("$@")
  sudo rm -rf /tmp/extcache || true
  for dep_ext in "${ext_array[@]}"; do
    dep_ext_name="${dep_ext/php$version-/}"
    if ! [ -d /tmp/extcache/"$dep_ext_name" ]; then
      update_lists
      ext_deps=$(apt-cache depends "$dep_ext" 2>/dev/null | awk -v ORS=' ' '/Depends: php'"$version"'-/{print$2}' | sort | uniq)
      ext_deps="${ext_deps//php$version-common/}"
      # shellcheck disable=SC2001
      ext_deps_array=()
      IFS=' ' read -r -a ext_deps_array <<<"$ext_deps"
      sudo mkdir -p /tmp/extcache/"$dep_ext_name"
      sudo chmod -R 777 /tmp/extcache/"$dep_ext_name"
      (
        cd /tmp/extcache || exit 1
        sudo apt-fast download "${ext_deps_array[@]}" >/dev/null 2>&1 || true
        for ext in "${ext_deps_array[@]}"; do
          if [ "x$ext" != "x" ]; then
            ext_name=${ext/php$version-/}
            (setup_extension "$ext_name" "$dep_ext_name" "$ext_dir" && add_log "$tick" "$ext_name") || add_log "$cross" "$ext_name"
          fi
        done
      )
    fi
  done    
}

setup_dependencies() {
  exts=$1
  ext_dir=$2
  exts=${exts// /}
  exts=${exts//,/ }
  exts=${exts//pdo_/}
  IFS=' ' read -r -a ext_array <<<"$exts"
  if [ "x${ext_array[0]}" != "x" ]; then
    # shellcheck disable=SC2001
    exts=$(echo "${ext_array[@]}" | sed "s/[^ ]* */php$version-&/g")
    IFS=' ' read -r -a ext_array <<<"$exts"
    if ! command -v apt-fast >/dev/null; then
      sudo ln -sf /usr/bin/apt-get /usr/bin/apt-fast
    fi
    setup_dependencies_extensions "$ext_dir" "${ext_array[@]}"
    deps=$(apt-cache depends "${ext_array[@]}" 2>/dev/null | awk -v ORS=' ' '/Depends: lib/{print$2}')
    if [ "x${deps}" != "x" ]; then
      IFS=' ' read -r -a deps_array <<<"$deps"
      (
        sudo DEBIAN_FRONTEND=noninteractive apt-fast install --no-install-recommends --no-upgrade -y "${deps_array[@]}" >/dev/null 2>&1 &&
        add_log "$tick" "${deps_array[@]}"
      ) || add_log "$cross" "${deps_array[@]}"
    fi
  fi
}

tick="✓"
cross="✗"
extensions=$1
key=$2
version=$3
os=$(uname -s)
old_versions="5.[4-5]"
nightly_versions="8.[1-9]"
if [ "$os" = "Linux" ]; then
  . /etc/lsb-release
  release=$DISTRIB_CODENAME
  os=$os-$release
  apiv=$(get_apiv)
  dir=$(linux_extension_dir "$apiv")
  sudo mkdir -p "$dir" && sudo chown -R "$USER":"$(id -g -n)" "$(dirname "$dir")"
  setup_dependencies "$extensions" "$dir"
elif [ "$os" = "Darwin" ]; then
  apiv=$(get_apiv)
  dir=$(darwin_extension_dir "$apiv")
  sudo mkdir -p "$dir" && sudo chown -R "$USER":"$(id -g -n)" "$(dirname "$dir")"
else
  os="Windows"
  dir='C:\\tools\\php\\ext'
fi
key="$os"-ext-"$version"-$(echo -n "$extensions-$key" | openssl dgst -sha256 | cut -d ' ' -f 2)
key="$key-20201231"
echo "::set-output name=dir::$dir"
echo "::set-output name=key::$key"
