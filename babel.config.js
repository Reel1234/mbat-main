module.exports = (api) => {
    api.cache.forever()
    return {
        presets: [
            [
                '@babel/env',
                {
                    loose: true,
                    exclude: ['transform-typeof-symbol']
                }
            ]
        ],
        plugins: [
            '@babel/proposal-object-rest-spread'
        ],
        babelrc: false
    }
}
