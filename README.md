<h1 align="center">Cache PHP extensions in GitHub Actions</h1>

<p align="center">
  <a href="https://github.com/shivammathur/cache-extensions" title="Cache PHP extensions in GitHub Actions"><img alt="GitHub Actions status" src="https://github.com/shivammathur/cache-extensions/workflows/Main%20workflow/badge.svg"></a>
  <a href="https://codecov.io/gh/shivammathur/cache-extensions" title="Code coverage"><img alt="Codecov Code Coverage" src="https://codecov.io/gh/shivammathur/cache-extensions/branch/master/graph/badge.svg"></a>
  <a href="https://github.com/shivammathur/cache-extensions/blob/master/LICENSE" title="license"><img alt="LICENSE" src="https://img.shields.io/badge/license-MIT-428f7e.svg"></a>
  <a href="#tada-php-support" title="PHP Versions Supported"><img alt="PHP Versions Supported" src="https://img.shields.io/badge/php-%3E%3D%205.3-8892BF.svg"></a>
</p>

Cache PHP extensions in [GitHub Actions](https://github.com/features/actions "GitHub Actions"). This action has to be used along with [shivammathur/setup-php](https://github.com/shivammathur/setup-php "Setup PHP") and [actions/cache](https://github.com/actions/cache "Cache in GitHub Actions") GitHub Actions. It configures the environment required to cache PHP extensions. Refer to [Usage](#memo-usage "How to use this") section to see how to use this.

## Contents

- [PHP Support](#tada-php-support)
- [OS/Platform Support](#cloud-osplatform-support)
- [Usage](#memo-usage)
- [License](#scroll-license)
- [Contributions](#1-contributions)
- [Support this project](#sparkling_heart-support-this-project)

## :tada: PHP Support

|PHP Version|Stability|Release Support|
|--- |--- |--- |
|5.3|`Stable`|`End of life`|
|5.4|`Stable`|`End of life`|
|5.5|`Stable`|`End of life`|
|5.6|`Stable`|`End of life`|
|7.0|`Stable`|`End of life`|
|7.1|`Stable`|`End of life`|
|7.2|`Stable`|`Security fixes only`|
|7.3|`Stable`|`Active`|
|7.4|`Stable`|`Active`|
|8.0|`Experimental`|`In development`|

## :cloud: OS/Platform Support

|Virtual environment|matrix.operating-system|
|--- |--- |
|Windows Server 2019|`windows-latest` or `windows-2019`|
|Ubuntu 18.04|`ubuntu-latest` or `ubuntu-18.04`|
|Ubuntu 16.04|`ubuntu-16.04`|
|macOS X Catalina 10.15|`macos-latest` or `macOS-10.15`|

## :memo: Usage

Inputs supported by this GitHub Action.

- php-version `required`
- extensions `required`
- key `required`

See [action.yml](action.yml "Metadata for this GitHub Action") and usage below for more info.

> Cache extensions in a PHP workflow

```yaml
jobs:
  run:
    runs-on: ${{ matrix.operating-system }}
    strategy:
      matrix:
        operating-system: [ubuntu-latest, windows-latest, macos-latest]
        php-versions: ['7.2', '7.3', '7.4']
    name: PHP ${{ matrix.php-versions }} Test on ${{ matrix.operating-system }}
    env:
      extensions: intl, pcov
      key: cache # can be any string
    steps:
    - name: Checkout
      uses: actions/checkout@v2

    - name: Setup cache environment
      id: cache-extensions
      uses: shivammathur/cache-extensions@v1
      with:
        php-version: ${{ matrix.php-versions }}
        extensions: ${{ env.extensions }}
        key: ${{ env.key }}

    - name: Cache extensions
      uses: actions/cache@v1
      with:
        path: ${{ steps.cache-extensions.outputs.ext_dir }}
        key: ${{ runner.os }}-ext-${{ matrix.php-versions }}-${{ steps.cache-extensions.outputs.ext_hash }}
        restore-keys: ${{ runner.os }}-ext-${{ matrix.php-versions }}-${{ steps.cache-extensions.outputs.ext_hash }}

    - name: Setup PHP
      uses: shivammathur/setup-php@v2
      with:
        php-version: ${{ matrix.php-versions }}        
        extensions: ${{ env.extensions }}
```

## :scroll: License

The scripts and documentation in this project are released under the [MIT License](LICENSE "License for shivammathur/cache-extensions"). This project has multiple [dependencies](https://github.com/shivammathur/cache-extensions/network/dependencies "Dependencies for this PHP Action"). Their licenses can be found in their respective repositories.

## :+1: Contributions

Contributions are welcome! See [Contributor's Guide](.github/CONTRIBUTING.md "shivammathur/cache-extensions contribution guide"). If you face any issues while using this or want to suggest a feature/improvement, create an issue [here](https://github.com/shivammathur/cache-extensions/issues "Issues reported").

## :sparkling_heart: Support this project

If this action helped you.

- Please star the project and share it with the community.
- If you blog, write about your experience while using this action.
- I maintain this in my free time, please support me with a [Patreon](https://www.patreon.com/shivammathur "Shivam Mathur Patreon") subscription or a one time contribution using [Paypal](https://www.paypal.me/shivammathur "Shivam Mathur PayPal").
- If you need any help using this, please contact me using [Codementor](https://www.codementor.io/shivammathur "Shivam Mathur Codementor")