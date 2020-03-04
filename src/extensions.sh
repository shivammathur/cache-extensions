linux_extension_dir() {
  apiv=$1
  old_versions_linux="5.[4-5]"
  if [ "$version" = "5.3" ]; then
    echo "/home/runner/php/5.3.29/lib/php/extensions/no-debug-non-zts-$apiv"
  elif [[ "$version" =~ $old_versions_linux ]]; then
    echo "/usr/lib/php5/$apiv"
  elif [ "$version" = "8.0" ]; then
    echo "/home/runner/php/8.0/lib/php/extensions/no-debug-non-zts-$apiv"
  else
    echo "/usr/lib/php/$apiv"
  fi
}

darwin_extension_dir() {
  apiv=$1
  old_versions_darwin="5.[3-5]"
  if [[ "$version" =~ $old_versions_darwin ]]; then
    echo "/usr/local/php5/lib/php/extensions/no-debug-non-zts-$apiv"
  else
    echo "/usr/local/lib/php/pecl/$apiv"
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
    *)
      php_h="https://raw.githubusercontent.com/php/php-src/master/main/php.h"
      curl -sSL --retry 5 "$php_h" | grep "PHP_API_VERSION" | cut -d' ' -f 3
      ;;
  esac
}

setup_dependencies() {
  exts=$1
  release=$2
  empty_reg="\s+|^$"
  script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )
  exts=${exts//,/}
  for ext in $exts; do
    if grep -i -q -w "$ext" "$script_dir"/lists/"$release"-php"$version"-extensions; then
      exts=${exts//$ext/}
    fi
  done
  if [[ ! "$exts" =~ $empty_reg ]]; then
    # shellcheck disable=SC2001,SC2086
    exts=$(echo ${exts//pdo_} | sed "s/[^ ]* */php$version-&/g")
    # shellcheck disable=SC2086
    deps=$(apt-cache depends $exts 2>/dev/null | awk '/Depends: lib/{print$2}')
    for dep in $deps; do
      if grep -i -q -w "$dep" "$script_dir"/lists/"$release"-libs; then
        deps=${deps//$dep/}
      fi
    done
    if [[ ! "${deps[*]}" =~ $empty_reg ]]; then
      echo "Adding ${deps[*]}"
      # shellcheck disable=SC2068
      sudo DEBIAN_FRONTEND=noninteractive apt-fast install --no-install-recommends --no-upgrade -y ${deps[@]}
    fi
  fi
}

extensions=$1
key=$2
version=$3
os=$(uname -s)
if [ "$os" = "Linux" ]; then
  release=$(lsb_release -s -c)
  os=$os-$release
  apiv=$(get_apiv)
  dir=$(linux_extension_dir "$apiv")
  sudo mkdir -p "$dir" && sudo chown -R "$USER":"$(id -g -n)" "$(dirname "$dir")"
  setup_dependencies "$extensions" "$release"
elif [ "$os" = "Darwin" ]; then
  apiv=$(get_apiv)
  dir=$(darwin_extension_dir "$apiv")
  sudo mkdir -p "$dir" && sudo chown -R "$USER":"$(id -g -n)" "$(dirname "$dir")"
else
  os="Windows"
  dir='C:\\tools\\php\\ext'
fi
key="$os"-ext-"$version"-$(echo -n "$extensions-$key" | openssl dgst -sha256 | cut -d ' ' -f 2)
echo "::set-output name=dir::$dir"
echo "::set-output name=key::$key"