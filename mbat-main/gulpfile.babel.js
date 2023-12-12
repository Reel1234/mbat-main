import gulp         from 'gulp'
import plugins      from 'gulp-load-plugins'
import browser      from 'browser-sync'
import del          from 'del'
import fs           from 'fs'
import merge        from 'merge-stream'
import yargs        from 'yargs'
import panini       from 'panini'
import rename       from 'rename'
import ftp          from 'vinyl-ftp'
import pathproc     from 'path'
import pkg          from './package.json'


const $ = plugins({
    postRequireTransforms: {
        sass: sass => sass(require('sass'))
    }
})

// Look for the --production flag
const PRODUCTION    = !!(yargs.argv.production)


let config          = require('./config.js'),
    banner          = config.banner,
    path            = config.path,
    cache           = config.cache,
    src             = config.src,
    dest            = config.dest


const deleteFile = ({basepath = path.app, distpath = path.dist, version = false, cacheName}) => (file) => {
        const relativeFile = pathproc.relative(pathproc.resolve(basepath), file)
        let distFile
        let deleted
        let distpath = (distpath) || path.dist

        if(version) {
            file = rename(
                file,
                {
                    extname: '.txt'
                })
        }

        distFile = pathproc.resolve(distpath, relativeFile)

        cacheName && [].concat(cacheName).map(cacheNameItem => {
            if($.cached.caches[cacheNameItem]) delete $.cached.caches[cacheNameItem][file]
            $.remember.forget(cacheNameItem, file)
        })

        deleted = del.sync(distFile)
        console.log('Deleted files and folders:\x1b[35m\n\t' + deleted.map(delItem => pathproc.relative(pathproc.resolve(path.dist), delItem).trim()).join('\n\t') + '\x1b[33m')
    }


const getFolders = dir => fs.readdirSync(dir).filter(file => fs.statSync(pathproc.join(dir, file)).isDirectory())
const watchers = {}
const watchFolders = ({ext, taskFunc, srcPath, prependTasks = [], appendTasks = []}) => () => {
            watchers[ext] && watchers[ext].map(watcher => watcher.close && watcher.close())
            watchers[ext] = getFolders(srcPath).map(folder => {
                const task = taskFunc(srcPath + (folder === 'main' ? '' : folder + '*') + '*.' + ext)
                task.displayName = taskFunc.name + ':' + folder
                return gulp.watch(
                    srcPath + folder + '/**/*.' + ext,
                    gulp.series([].concat(prependTasks, task, appendTasks))
                )
            })
        }



// Delete the "dist" folder
// This happens every time a build starts
gulp.task('clean', () => {
    return del([
        path.dist
    ])
})
gulp.task('clean:code', () => {
    return del([
        path.dist+'**/*.txt'
    ])
})

// Reload browser
gulp.task('reload', done => {
    browser.reload()
    done()
})

// Rootfiles
gulp.task('rootfiles', () => {
    const imgFilter = $.filter(file => /\.(jpg|jpeg|png|gif)/i.test(file.extname), {restore: true})
    return gulp.src(src.rootfiles, {dot: true})
        .pipe($.newer(dest.rootfiles))
        .pipe(imgFilter)
        .pipe($.imagemin())
        .pipe(imgFilter.restore)
        .pipe(gulp.dest(dest.rootfiles))
})


// Compile layouts, pages, and partials into flat HTML files
const pages = ({version, reset} = {}) => {
    const newerOptions = {dest: dest.pages}
    if(version === 'code') {
        newerOptions.ext = '.txt'
    }
    let stream = gulp.src(src.pages)
        .pipe($.if(
            !reset,
            $.newer(newerOptions)
        ))
        .pipe(
            $.replace('/'+dest.pages, "/")
        )
        .pipe(
            $.replace(
                new RegExp('\/'+path.app.replace('/','\/')+'((?:[\\w-.\{\}]+?\/)*)([\\w-.@\{\}]+?)\\.([\\w]+)','g'),
                (m, dir, name, ext) => {
                    if(ext === 'scss') {
                        dir = dir.replace(/(sass)\/$/,'css/')
                        ext = 'css'
                    }
                    name = name.replace(/^_/,'')
                    return `/${dir}${name}.${ext}`
                })
        )

    if (version === 'code') {
        stream = stream
            .pipe(
                $.replace(
                    /^([\n\r\s]*---)([\s\S]*?)(---)/i,
                    (m, start, body, end) => {
                        if(/[\n\r]layout:/.test(body)) {
                            body = body.replace(/([\n\r]layout:).*/,'$1 code')
                        } else {
                            body += '\nlayout: code\n'
                        }
                        return `${start}${body}${end}`
                    }
                )
            )
            .pipe(
                $.tap(
                    (file, t) => t.through($.inline, [{
                        base: path.dist,
                        css: () => $.purgecss({content: [file.path]}),
                        disabledTypes: ['js','img','svg']
                    }])
                )
            )
            .pipe(
                $.replace(/<\/?(html|head|body)(\s[^>]*)?>/ig, '')
            )
    }
    stream = stream
        .pipe(panini({
            root:       path.pages,
            layouts:    path.layouts,
            partials:   path.partials,
            helpers:    path.helpers,
            data:       path.data
        }))
        .pipe(
            $.replace(new RegExp('\/'+path.assets.replace('/','\/'),'g'), "/")
        )
        .pipe(
            $.replace(/(^|<[^>]+>)([^<]+)(?=<|$)/ig, (m, tagOpen, text) => {
                if(!/<(style|script)>/.test(tagOpen)) {
                    text = text
                        .replace(/(^|\s|&nbsp;|\()([aiowuz])\s+/gi,"$1$2&nbsp;")
                        .replace(/(^|\s|&nbsp;)([aiowuz])\s+/gi,"$1$2&nbsp;")
                        .replace(/((?:^|[^\s])\s)\s{1,2}(?=[^\s]|$)/gi,"$1")
                        .replace(/(\d(\s?))-(?=\2\d)/gi,"$1&ndash;")
                        .replace(/(\s|^)-(?=\s)/gi,"$1&mdash;")
                }
                return tagOpen + text
            })
        )
        .pipe(
            $.replace(/((?:[^\s]))\s+$/gi,"$1")
        )
        .pipe(
            $.if(
                version === 'code',
                $.rename({
                    extname: '.txt'
                }
            )
        ))
        .pipe(gulp.dest(dest.pages))

    return stream
}

//gulp.task('pages', pages)
gulp.task('pages', () => {
    panini.refresh()
    return merge(
        pages(),
        pages({version:'code'})
    )
})
// Reset Panini's cache of layouts and partials
gulp.task('pages:reset', () => {
    panini.refresh()
    return merge(
        pages({reset:true}),
        pages({reset:true, version:'code'})
    )
})

gulp.task('pages:index', () => {
//    return gulp.src('./'+dest.pages+'**/*.html', {base: '.'})
    const pathSeparator = /[\/\\]/
    return gulp.src([
            dest.rootfiles+'**/*.html'
        ])
        .pipe($.sort({
            comparator: (fileA, fileB) => {
                const fAp = pathproc.relative(pathproc.resolve(dest.pages), fileA.path),
                    fBp = pathproc.relative(pathproc.resolve(dest.pages), fileB.path),
                    fAIsChild = !(pathSeparator.test(fAp)),
                    fBIsChild = !(pathSeparator.test(fBp))

                if( fAIsChild && !fBIsChild ) return -1
                if( !fAIsChild && fBIsChild ) return 1

                return fAp.localeCompare(fBp)
            }
        }))
        .pipe($.fileindex())
        .pipe($.replace(/style="[^"]+"/g,'class="list-group-item"'))
        .pipe($.replace(/(>)(.+?)(<\/a)/g, (m,open,content,close) => {
            let segments = content.split(/\/|\\/g)

            segments[segments.length - 1] = '<strong>' + segments[segments.length - 1] + '</strong>'

            return open + segments.join(' <span style="color:#ddd;">&sol;</span> ') + close
        }))

        .pipe($.replace(/^/,
`---
title:     Index
layout:    index
---
`))
        .pipe(panini({
            root: path.pages,
            layouts: path.layouts,
            partials: path.partials,
            helpers: path.helpers,
            data: path.data
        }))
        .pipe(gulp.dest(dest.rootfiles))
})


// Sass
const sass = (fileSrc, { newer = false } = {}) => () => {
        const file = typeof fileSrc === 'function' ? fileSrc() : fileSrc

        let stream = gulp.src(file, {
            base: path.sass,
            allowEmpty: true
        })
            .pipe($.plumber())
            .pipe($.if(newer, $.newer({
                dest: dest.sass,
                ext: '.css'
            })))
            // .pipe($.sassVars(extend({}, global, { directory }), { verbose: false }))
            .pipe($.sass(config.sassOptions).on('error', $.sass.logError))
            .pipe($.postcss())
            .pipe($.replace('/'+path.assets.replace(/\/$/,''),'/assets'))
            .pipe($.cleanCss(config.cleanCssOptions))
            .pipe(gulp.dest(dest.sass))
            .pipe(browser.stream({ match: '**/*.{css,map}' }))

        return stream
    }

const sassLint = () => {
    let stream = gulp.src(src.sass.lint)
        .pipe($.plumber())
        .pipe($.cached(cache.sass))
        .pipe($.stylelint({
            reporters: [
                { formatter: 'verbose', console: true }
            ]
        }))

    stream = stream
        .on('error', e => {
            $.log(e.toString())
            if (PRODUCTION) {
                delete $.cached.caches[cache.sass]
                $.remember.forgetAll(cache.sass)
            }

            stream.end()
        })
        .pipe($.remember(cache.sass))

    return stream
}

gulp.task('sass', sass(src.sass, { newer: true }), sassLint)



// JS
gulp.task('js:hint', () =>
    gulp.src(src.js.hint)
        .pipe($.cached(cache.scripts))
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish',{ verbose: true }))
        .pipe($.remember(cache.scripts))
)


const js = (file, options) => () => {
        const jsFilter = $.filter(item => /\.js/i.test(item.extname), {restore: true})

        const stream = gulp.src(file, {base: path.js, allowEmpty: true})
            .on('error', e => {
                $.util.log(e.toString())
                stream.end()
            })
            .pipe($.plumber())
            .pipe($.if(options && options.newer, $.newer(dest.js.main)))
            .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
            .pipe($.jsImport({hideConsole: true}))
            .pipe($.if(!PRODUCTION, $.sourcemaps.write('../maps')))
            .pipe($.if(PRODUCTION, $.header(banner, { pkg : pkg } )))
            .pipe(gulp.dest(dest.js.main))
            .pipe($.debug({title: 'js'}))
            .pipe(jsFilter)
            .pipe($.uglify({
                    preserveComments: 'some'
                }))
            .pipe($.rename({suffix: '.min'}))
            .pipe(gulp.dest(dest.js.main))

        return stream
    }

gulp.task('js', js (src.js.main, {newer: true}))

gulp.task('js:vendor', () => {
    return gulp.src(src.js.vendor)
        .pipe($.newer(dest.js.vendor))
        .pipe(gulp.dest(dest.js.vendor))
})

// Fonts
gulp.task('fonts', () => {
    return gulp.src(src.fonts)
        .pipe($.newer(dest.fonts))
        .pipe(gulp.dest(dest.fonts))
})

// Copy and compress images
gulp.task('images', () => {
    const svgFilter = $.filter(['**/*.svg', '!**/fonts/*.*'], {restore: true, passthrough: false})

    return merge(
        gulp.src(src.images)
            .pipe($.newer(dest.images))
            .pipe(svgFilter)
            .pipe($.svgmin({
                plugins: [
                    { removeViewBox: false },
                    { removeUselessStrokeAndFill: false },
                    { collapseGroups: false },
                    { convertShapeToPath: false },
                    { mergePaths: false },
                    { moveElemsAttrsToGroup: false },
                    { moveGroupAttrsToElems: false },
                    { removeHiddenElems: {
                        opacity0: false
                    }}
                ]
            })),
        svgFilter.restore
            .pipe($.imagemin())
    ).pipe(gulp.dest(dest.images))
})


// Start a server with LiveReload to preview the site in
gulp.task('server', done => {
    browser.init({
        server: path.dist
    })
    done()
})



// Build the "dist" folder by running all of the above tasks
gulp.task('build',
    gulp.parallel(
        'rootfiles',
        gulp.series(
            'sass',
            'pages',
            'pages:index'
        ),
        gulp.series(
            'js:hint',
            gulp.parallel(
                'js',
                'js:vendor'
            )
        ),
        'images'
    )
)


// Watch for file changes
gulp.task('watch', () => {

    gulp.watch('./config.js',
        gulp.series(
            (done) => {
                delete require.cache[require.resolve('./config.js')]
                config = require('./config.js')
                banner = config.banner
                path   = config.path
                cache  = config.cache
                src    = config.src
                dest   = config.dest
                done()
            },
            'build',
            'reload'
        )
    )

    gulp.watch(
        src.pages,
        gulp.series('pages', 'pages:index', 'reload')
    )
        .on('unlink', deleteFile({cacheName: cache.pages, basepath: path.pages}))
        .on('unlink', deleteFile({cacheName: cache.pages, basepath: path.pages, version: 'code'}))

    gulp.watch(
        [
            path.layouts+'**/*',
            path.partials+'**/*',
            path.helpers+'**/*',
            path.data+'**/*'
        ],
        gulp.series('clean:code', 'pages:reset', 'pages:index', 'reload')
    )

    gulp.watch(
        src.sass,
        gulp.series('clean:code', 'sass', 'pages')
    )

    const watchSass = watchFolders({
        ext:               'scss',
        taskFunc:          sass,
        srcPath:           path.sass,
        prependTasks:      ['clean:code'],
        appendTasks:       ['pages']
    })

    gulp.watch(path.sass+'**')
        .on('addDir', watchSass)
        .on('unlinkDir', dir => {
            deleteFile({cacheName: cache.sass}) (dir + '.css')
            watchSass()
        })

    watchSass()


    gulp.watch(
        path.js+'**/*.js',
        gulp.series(
            'js:hint'
        )
    )
        .on('unlink', deleteFile({cacheName: cache.scripts}))

    gulp.watch(
        src.js.main,
        gulp.series(
            'js',
            'reload'
        )
    )
        .on('unlink', deleteFile({cacheName: cache.scripts}))

   const watchJS = watchFolders({
        ext:               'js',
        taskFunc:          js,
        srcPath:           path.js,
        appendTasks:       ['reload']
    })

    gulp.watch(path.js+'**')
        .on('addDir', watchJS)
        .on('unlinkDir', dir => {
            // deleteFile({cacheName: cache.scripts}) (dir + '.js')
            watchJS()
        })

    watchJS()


    gulp.watch(
        src.js.vendor,
        gulp.series(
            'js:vendor',
            'reload'
        )
    )
        .on('unlink', deleteFile({cacheName: cache.scripts}))

    gulp.watch(
        src.images,
        gulp.series('images', 'reload')
    )
        .on('unlink', deleteFile({cacheName: cache.images}))



    gulp.watch(
        src.rootfiles,
        gulp.series('rootfiles', 'reload')
    )
        .on('unlink', deleteFile({cacheName: cache.rootfiles, basepath: path.rootfiles}))


})

// Build, run the server, and watch for file changes
gulp.task('default',
    gulp.series('build', 'server', 'watch'))


// Compress into Zip
gulp.task(
    'zip',
    () => gulp.src([
            '**/*',
            '!dist/**/*',
            '!dist',
            '!node_modules/**/*',
            '!node_modules',
            '!tests_results/**/*',
            '!tests_results',
            '!.git/**',
            '!**/*.zip'
            ],
            {dot: true}
        )
        .pipe($.zip((pkg.name+'-'+pkg.version+'.zip').toLowerCase()))
        .pipe(gulp.dest('./'))
)

// Bump version
// args: --type=major|minor|patch OR --version=X.X.X
gulp.task('bump', done => {
    gulp.src(['./{bower,package}.json'])
        .pipe($.bump(yargs.argv))
        .pipe(gulp.dest('./'))
    done()
})


// helper function to build an FTP connection based on our configuration
const getFtpConnection = () => {
    const def = config.FTP[yargs.argv.type || "test"],
        options = {
            parallel: 5,
            log: $.util.log
        }

    for(let i in def) {
        if (def.hasOwnProperty(i)) {
            options[i] = def[i]
        }
    }

    return ftp.create(options)
}


gulp.task('ftp-sync', () => {

    const conn = getFtpConnection()
    const def = config.FTP[yargs.argv.type || "test"]

    return gulp.src(
        [
            path.dist + '**/*',
            '!' + path.dist + 'content/_org/**/*'
        ],
        {
            base: path.dist,
            buffer: false,
            dot:true
        })
        .pipe( conn.newer( def.remoteFolder ) ) // only upload newer files
        .pipe( conn.dest( def.remoteFolder ) )

})

gulp.task('watch-ftp', gulp.series(
    'ftp-sync',
    () => {
        gulp.watch(path.dist+'**/*', gulp.series('ftp-sync'))
    })
)

