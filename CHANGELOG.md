# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.6.10](https://github.com/darkobits/sentinelle/compare/v0.6.9...v0.6.10) (2021-08-12)


### 🏗 Chores

* **deps:** Update dependencies. ([029bd97](https://github.com/darkobits/sentinelle/commit/029bd97212658202622b0ec693a2a6124fa0cb44))
* Update ci.yml. ([c1cb738](https://github.com/darkobits/sentinelle/commit/c1cb738536244060ad5b7cd35e3d51cabdb462e8))


### 🛠 Refactoring

* Misc. refactoring. ([d6dcddd](https://github.com/darkobits/sentinelle/commit/d6dcddd9aa371a58037013d907991ced743da414))

### [0.6.9](https://github.com/darkobits/sentinelle/compare/v0.6.8...v0.6.9) (2021-06-05)


### 🏗 Chores

* Remove Docker image references. ([dbc7875](https://github.com/darkobits/sentinelle/commit/dbc787545c3e06a5c0dba8319b213c719b5daa50))


### 📖 Documentation

* Update README. ([c01d371](https://github.com/darkobits/sentinelle/commit/c01d37158fc904f8730e5d909cdfd898581c8df7))

### [0.6.8](https://github.com/darkobits/sentinelle/compare/v0.6.7...v0.6.8) (2021-05-13)


### 📖 Documentation

* Update README. ([2d2ee96](https://github.com/darkobits/sentinelle/commit/2d2ee967cfa4d7b734cdc459c0c653e26dc94068))
* Update README. ([d79ffde](https://github.com/darkobits/sentinelle/commit/d79ffde6941ec077e2b789c6d6eee5a7dbb79194))
* Update README. ([39614cc](https://github.com/darkobits/sentinelle/commit/39614ccbf3fdfbeefff06e715381817e2fa495c6))
* Update README. ([ea58fa1](https://github.com/darkobits/sentinelle/commit/ea58fa10314497006c6d73cad16e024e6e49fac2))


### 🏗 Chores

* **deps:** bump handlebars from 4.7.6 to 4.7.7 ([#135](https://github.com/darkobits/sentinelle/issues/135)) ([3181adf](https://github.com/darkobits/sentinelle/commit/3181adf17d07637f426c58075ac9239f5a2b9129))
* **deps:** bump hosted-git-info from 2.8.8 to 2.8.9 ([#137](https://github.com/darkobits/sentinelle/issues/137)) ([1a8ce30](https://github.com/darkobits/sentinelle/commit/1a8ce309b248836390280806da3dcef1d314b7e4))
* **deps:** bump lodash from 4.17.20 to 4.17.21 ([#136](https://github.com/darkobits/sentinelle/issues/136)) ([2c71c1b](https://github.com/darkobits/sentinelle/commit/2c71c1bdf98bdc97ba62dd9e26f1b075a32bb8aa))
* **deps:** Update dependencies. ([bf60e28](https://github.com/darkobits/sentinelle/commit/bf60e28f90d2f41a7fbded1b9c2957c42e2485c3))
* **deps:** Update dependencies. ([ba4e0fd](https://github.com/darkobits/sentinelle/commit/ba4e0fd13fff24bf24f0c36623d4f0e96a95f657))
* Update dependencies. ([673acf1](https://github.com/darkobits/sentinelle/commit/673acf1fa140e63dfa1f23acc136676cdc8cfde9))
* Update GitHub Actions configuration. ([dfb420c](https://github.com/darkobits/sentinelle/commit/dfb420c8cb5dfb07c4c040479118817622c32705))
* Update TS config. ([c957ade](https://github.com/darkobits/sentinelle/commit/c957ade62cd319488c7d917a9d05f628f5634a98))

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
