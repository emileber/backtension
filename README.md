# Backtension

[![Greenkeeper badge](https://badges.greenkeeper.io/emileber/backtension.svg)](https://greenkeeper.io/)

***Please note that this is in development and not working as-is for now. Development will resume when I have time.***

Relieves the tension caused by the use of Backbone by providing an unopinionated and unobtrusive set of missing features inside of Backbone's core. These are mostly good practices that can be found around the interweb, and they're made easily available by being transparently integrated and field tested.

## Features

- Heavy use of view's `setElement` through the custom `assign` method.
- Easy cleanup of child views.
- Common element caching through `regions` and `zone`.
- View disabling to prevent listeners from triggering when not needed.
- Global events like resize.
- Model attributes blacklist.
- and more...

The same compatibility as Backbone.

## Goals

Backbone was the sh!t back in 2011-2012 and most information (blog posts, tutorials, Stack Overflow answers) is now dated and often provides wrong or outdated ways to use Backbone. After having searched the web myself for solution to lots of common problems and in order to educate new (and even experienced) users to how backbone should be used, I decided that I should share the little extension I was building while developing a massive application.

Backtension will help prevent memory leaks by providing the tools and documentation to develop memory efficient applications. It'll also improve performance by offering to defer tasks that are not needed immediately.
