fetch_brew_tap() {
  tap=$1
  tap_user=$(dirname "$tap")
  tap_name=$(basename "$tap")
  mkdir -p "$tap_dir/$tap_user"
  curl -sL "https://github.com/$tap/archive/master.tar.gz" | sudo tar -xzf - -C "$tap_dir/$tap_user"
  if [ -d "$tap_dir/$tap_user/$tap_name-master" ]; then
    sudo mv "$tap_dir/$tap_user/$tap_name-master" "$tap_dir/$tap_user/$tap_name"
  fi
}

add_brew_tap() {
  tap=$1
  if ! [ -d "$tap_dir/$tap" ]; then
    if [ "${ImageOS:=}-${ImageVersion:=}" = "-" ]; then
      brew tap --shallow "$tap" >/dev/null 2>&1
    else
      fetch_brew_tap "$tap" >/dev/null 2>&1
      if ! [ -d "$tap_dir/$tap" ]; then
        brew tap --shallow "$tap" >/dev/null 2>&1
      fi
    fi
  fi
}

get_dependencies() {
  extension=$1
  list_deps="$(grep "$extension" "${script_dir:?}"/../lists/darwin-deps | cut -d '=' -f 2)"
  formula_file="$tap_dir/$ext_tap/Formula/$extension@${version:?}.rb"
  if [ -e "$formula_file" ]; then
    formula_deps="$(grep "depends_on" "$formula_file" | cut -d '"' -f 2 | tr '\n' ' ')"
    formula_deps_from_macos="$(grep "uses_from_macos \"lib" "$formula_file" | cut -d '"' -f 2 | tr '\n' ' ')"
  fi
  deps=()
  [[ -n "${list_deps[*]}" ]] && deps+=("${list_deps[@]}")
  [[ -n "${formula_deps[*]}" ]] && deps+=("${formula_deps[@]}")
  [[ -n "${formula_deps_from_macos[*]}" ]] && deps+=("${formula_deps_from_macos[@]}")
  echo "${deps[@]}"
}

filter_extensions() {
  extensions_array=("$@")
  filtered_extensions=()
  for ext in "${extensions_array[@]}"; do
    if grep -i -q -w "$ext" "${script_dir:?}"/../lists/darwin-extensions ||
      grep -q "$ext=" "${script_dir:?}"/../lists/darwin-deps; then
      filtered_extensions+=("$ext")
    fi
  done
  echo "${filtered_extensions[@]}"
}

setup_extensions_helper() {
  dependent_extension=$1
  dependency_extension=$2
  extension_dir=$3
  cached_extension="${deps_cache_directory:?}/$dependency_extension.so"
  if ! [ -e "$cached_extension" ]; then
    brew install "$dependency_extension@$version"
    sudo find "$brew_cellar/$dependency_extension@${version:?}" -name "$dependency_extension.so" -exec cp {} "$cached_extension" \;
  else
    echo "Found $dependency_extension extension in cache"
    sudo cp "$cached_extension" "$extension_dir/"
  fi
  add_config "$dependent_extension" "$dependency_extension"
}

setup_extensions() {
  dependent_extension=$1
  extension_dir=$2
  shift 2
  dependency_extensions_array=("$@")
  sudo mkdir -p "$cache_directory"/"$extension"
  echo "::group::Logs to set up extensions required for $extension"
  for dependency_extension in "${dependency_extensions_array[@]}"; do
    setup_extensions_helper "$dependent_extension" "$dependency_extension" "$extension_dir"
  done
  echo "::endgroup::"
  add_log "${tick:?}" "${dependency_extensions_array[@]}"
}

add_library_helper() {
  dep_name=$1
  cache_dir=$2
  [ -e "$cache_dir"/list ] && grep -Eq "^$dep_name" "$cache_dir"/list && return
  echo "$dep_name" | sudo tee -a "$cache_dir"/list >/dev/null 2>&1
  (
    cd "$brew_cellar" || exit 1
    if command -v gtar >/dev/null; then
      sudo gtar -I "zstd -T0" -cf "$cache_dir"/"$dep_name".tar.zst "$dep_name"
    else
      sudo tar -cf - "$dep_name" | zstd -T0 > "$cache_dir"/"$dep_name".tar.zst
    fi
  )
}

add_library() {
  lib=$1
  cache_dir=$2
  brew list "$lib" &>/dev/null || brew install "$lib"
  IFS=' ' read -r -a deps_array <<<"$(brew deps --formula "$lib" | tr '\n' ' ')"
  to_wait=()
  for dep_name in "$lib" "${deps_array[@]}"; do
    add_library_helper "$dep_name" "$cache_dir" &
    to_wait+=($!)
  done
  wait "${to_wait[@]}"
}

restore_library_helper() {
  dep_name=$1
  cache_dir=$2
  if ! [ -d "$brew_cellar/$dep_name" ]; then
    if command -v gtar >/dev/null; then
      sudo gtar -I "zstd -d" -xf "$cache_dir"/"$dep_name".tar.zst -C "$brew_cellar"
    else
      sudo zstd -dq "$cache_dir"/"$dep_name".tar.zst && sudo tar -xf "$cache_dir"/"$dep_name".tar -C "$brew_cellar"
    fi
  fi
  if ! [ -d "$brew_prefix/opt/$dep_name" ]; then
    brew link --force --overwrite "$dep_name" 2>/dev/null || true
  fi
  if ! [ -d "$brew_prefix/opt/$dep_name" ]; then
    sudo ln -sf "$brew_cellar"/"$dep_name"/* "$brew_prefix"/opt/"$dep_name"
  fi  
}

restore_library() {
  cache_dir=$1
  to_wait=()
  while read -r dep_name; do
    restore_library_helper "$dep_name" "$cache_dir" &
    to_wait+=($!)
  done <"$cache_dir"/list
  wait "${to_wait[@]}"
}

setup_libraries() {
  extension=$1
  shift 1
  libraries_array=("$@")
  ext_deps_dir="$deps_cache_directory/$extension"
  sudo cp -a "$tap_dir"/"$ext_tap"/.github/deps/"$extension"/*.rb "$tap_dir"/"$core_tap"/Formula/ 2>/dev/null || true
  sudo mkdir -p "$ext_deps_dir"
  echo "::group::Logs to set up libraries required for $extension"
  if ! [ -e "$ext_deps_dir"/list ]; then
    for lib in "${libraries_array[@]}"; do
      add_library "$lib" "$ext_deps_dir"
    done
  else
    restore_library "$ext_deps_dir"
  fi
  echo "::endgroup::"
  add_log "$tick" "${libraries_array[@]}"
}

setup_dependencies() {
  extensions=$1
  extension_dir=$2
  cache_directory=/tmp/extcache
  [[ -z "${extensions// /}" ]] && return
  IFS=' ' read -r -a extensions_array <<<"$(echo "$extensions" | sed -e "s/pdo[_-]//g" -Ee "s/^|,\s*/ /g")"
  IFS=' ' read -r -a extensions_array <<<"$(filter_extensions "${extensions_array[@]}")"
  if [[ -n "${extensions_array[*]// /}" ]]; then
    add_brew_tap "$php_tap"
    add_brew_tap "$ext_tap"        
    for extension in "${extensions_array[@]}"; do
      IFS=' ' read -r -a dependency_array <<<"$(get_dependencies "$extension")"
      IFS=' ' read -r -a extension_array <<<"$(echo "${dependency_array[@]}" | grep -Eo "shivammathur[a-z\/]*@" | cut -d '/' -f 3 | sed 's/@//' | tr '\n' ' ')"
      IFS=' ' read -r -a libraries_array <<<"${dependency_array[@]//shivammathur*/}"
      if [[ -n "${libraries_array[*]// /}" ]]; then
        step_log "Setup libraries for $extension"
        setup_libraries "$extension" "${libraries_array[@]}"
      fi
      if [[ -n "${extension_array[*]// /}" ]] && [ "${skip_dependency_extensions:=}" != "true" ]; then
        step_log "Setup extensions for $extension"
        setup_extensions "$extension" "$extension_dir" "${extension_array[@]}"
      fi
    done
  fi
}

self_hosted_helper() {
    :
}

export HOMEBREW_CHANGE_ARCH_TO_ARM=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1

brew_prefix="$(brew --prefix)"
brew_cellar="$brew_prefix/Cellar"
tap_dir="$(brew --repository)"/Library/Taps
core_tap=homebrew/homebrew-core
php_tap=shivammathur/homebrew-php
ext_tap=shivammathur/homebrew-extensions
