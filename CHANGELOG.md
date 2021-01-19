# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.6.7](https://github.com/darkobits/sentinelle/compare/v0.6.6...v0.6.7) (2020-12-21)


### 🏗 Chores

* Add .travis.yml. ([33a28ed](https://github.com/darkobits/sentinelle/commit/33a28ede03b96daebbcf39b6f324347327fc0e3c))
* Update ci.yml. ([b39df80](https://github.com/darkobits/sentinelle/commit/b39df80cf09649b707e8218be2d9d164e32274a0))
* Update dependencies. ([cdd717b](https://github.com/darkobits/sentinelle/commit/cdd717b346302561bb99cb55f6e7d1bcac413188))
* Update dependencies. ([7ac64a4](https://github.com/darkobits/sentinelle/commit/7ac64a430269c0d7f12af6751d2c7adc2bec998b))

### [0.6.6](https://github.com/darkobits/sentinelle/compare/v0.6.5...v0.6.6) (2019-10-04)

### [0.6.5](https://github.com/darkobits/sentinelle/compare/v0.6.4...v0.6.5) (2019-08-29)

### [0.6.4](https://github.com/darkobits/sentinelle/compare/v0.6.3...v0.6.4) (2019-08-01)



### [0.6.3](https://github.com/darkobits/sentinelle/compare/v0.6.2...v0.6.3) (2019-07-02)



### [0.6.2](https://github.com/darkobits/sentinelle/compare/v0.6.1...v0.6.2) (2019-07-01)



### [0.6.1](https://github.com/darkobits/sentinelle/compare/v0.6.0...v0.6.1) (2019-07-01)


### Bug Fixes

* Revert shutdown grace period. ([5850c21](https://github.com/darkobits/sentinelle/commit/5850c21))



## [0.6.0](https://github.com/darkobits/sentinelle/compare/v0.5.3...v0.6.0) (2019-06-30)


### refactor

* Upgrade to execa 2.0.0, update API. ([3783083](https://github.com/darkobits/sentinelle/commit/3783083))

* Sentinelle now supports running any executable file/script as long as it has the appropriate file permissions and begins with a shebang.


### BREAKING CHANGES

* This update simplifies how custom arguments are passed to programs and the binary used to execute them. Instead of using "--" followed by custom binary arguments, users may now wrap the --bin argument in quotes and pass any arguments necessary.



### [0.5.3](https://github.com/darkobits/sentinelle/compare/v0.5.2...v0.5.3) (2019-06-07)



## [0.5.2](https://github.com/darkobits/sentinelle/compare/v0.5.1...v0.5.2) (2019-05-07)



## [0.5.1](https://github.com/darkobits/sentinelle/compare/v0.5.0...v0.5.1) (2019-05-05)



# [0.5.0](https://github.com/darkobits/sentinelle/compare/v0.4.0...v0.5.0) (2019-05-01)


### Features

* Add `restart` method. ([693b09e](https://github.com/darkobits/sentinelle/commit/693b09e))
* Allow additional arguments to be passed to entrypoint. ([f31dd12](https://github.com/darkobits/sentinelle/commit/f31dd12))
* Track state of attached Node debuggers. ([d49cd47](https://github.com/darkobits/sentinelle/commit/d49cd47))



# [0.4.0](https://github.com/darkobits/sentinelle/compare/v0.3.0...v0.4.0) (2019-04-30)


### Features

* Print version on startup. ([650a960](https://github.com/darkobits/sentinelle/commit/650a960))



# [0.3.0](https://github.com/darkobits/sentinelle/compare/v0.2.0...v0.3.0) (2019-04-29)


### Features

* **CLI:** Add 'quiet' option. ([81dbce8](https://github.com/darkobits/sentinelle/commit/81dbce8))



## [0.2.1](https://github.com/darkobits/sentinelle/compare/v0.2.0...v0.2.1) (2019-04-24)



# [0.2.0](https://github.com/darkobits/sentinelle/compare/v0.1.1...v0.2.0) (2019-04-18)


### Features

* Improve handling of exotic exit situations. ([38f1cd5](https://github.com/darkobits/sentinelle/commit/38f1cd5))
* User may provide custom kill signal. ([3606026](https://github.com/darkobits/sentinelle/commit/3606026))



## [0.1.1](https://github.com/darkobits/sentinelle/compare/v0.1.0...v0.1.1) (2019-04-17)



# 0.1.0 (2019-04-17)


### Features

* Add Sentinelle. ([a3c4eea](https://github.com/darkobits/sentinelle/commit/a3c4eea))
