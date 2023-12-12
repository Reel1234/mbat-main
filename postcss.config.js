import postcssSortingConfig from './.postcss-sorting'

module.exports = () => ({
    plugins: {
        'postcss-sorting': postcssSortingConfig,
        autoprefixer: {
            cascade: false
        }
    }
})
