var config = {
    "autoprefixerBrowsers": [
      "Android 2.3",
      "Android >= 4",
      "Chrome >= 20",
      "Firefox >= 24",
      "Explorer >= 8",
      "iOS >= 6",
      "Safari >= 6"
    ],
    "FTP": {
        "test": {
            "host":         "",
            "user":         "",
            "password":     "",
            "port":         21,
            "remoteFolder": ""
        },
        "prod": {
            "host":         "",
            "user":         "",
            "password":     "",
            "port":         21,
            "remoteFolder": "/"
        }
    }
}

config.banner = ['/*!',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version: v<%= pkg.version %>',
  ' * @link: <%= pkg.homepage %>',
  ' * @author: <%= pkg.author %>',
  ' * Copyright 2014-<%= new Date().getFullYear() %> <%= pkg.name %>' +
  ' */\n',
  ''].join('\n')


config.cache = {
        pages: 'pages',
        scripts: 'scripts',
        vendor: 'vendor',
        fonts: 'fonts',
        rootfiles: 'rootfiles',
        content: 'content',
        images: 'images'
    }


var path = config.path = {}

path.app            = 'app/'

path.assets         = path.app + 'assets/'
path.sass           = path.assets + 'sass/'
path.js             = path.assets + 'js/'
path.img            = path.assets + 'img/'
path.content        = path.assets + 'content/'
path.fonts          = path.assets + 'fonts/'
path.rootfiles      = path.assets + 'rootfiles/'

path.pages      = path.app + 'pages/'
path.helpers    = path.app + 'helpers/'
path.partials   = path.app + 'partials/'
path.layouts    = path.app + 'layouts/'
path.data       = path.app + 'data/'

path.dist       = 'dist/'

var srcJS = []

srcJS = srcJS.concat([
    '_globals.js',
    '_main.js'
].map(file => path.js + file))

config.src = {
    rootfiles:  path.rootfiles+'**/*',
    pages:      path.pages+'**/*.{html,hbs,handlebars}',
    sass:       path.sass+'*.scss',
    js:         {
        main:       path.js+'*.js',
        hint:       [
                        path.js+'**/*.js',
                        '!'+path.js+'vendor/**/*.js'
                    ],
        vendor:     [
                        path.js+'vendor/**/*.js'/*,
                        path.comp.jquery+'dist/jquery.min.js'*/
                    ]
    },
    fonts:      path.fonts+'**/*',
    images:     path.img+'**/*'
}

config.dest = {
    rootfiles:  path.dist,
    pages:      path.dist+'pages/',
    sass:       path.dist+'assets/css/',
    js:         {
        main:       path.dist+'assets/js/',
        vendor:     path.dist+'assets/js/vendor/'
    },
    fonts:      path.dist+'assets/fonts/',
    images:     path.dist+'assets/img/'

}

config.sassOptions = {
    outputStyle: 'expanded',
    includePaths: [
        'node_modules/'
    ],
    quietDeps: true
}

config.cleanCssOptions = {
    level: {
        1: {
            specialComments: 0
        },
        2: true
    }
}

module.exports = config
