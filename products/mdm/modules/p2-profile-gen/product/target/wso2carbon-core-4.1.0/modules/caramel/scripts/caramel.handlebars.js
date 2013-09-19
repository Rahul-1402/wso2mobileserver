caramel.engine('handlebars', (function () {
    var renderData, partials, init, page, render, meta, partialsDir, renderJS, renderCSS,
        pagesDir, populate, serialize, globals, theme, renderersDir, helpersDir,
        log = new Log(),
        Handlebars = require('handlebars').Handlebars;

    /**
     * Registers  'include' handler for area inclusion within handlebars templates.
     * {{include body}}
     */
    Handlebars.registerHelper('include', function (contexts) {
        var i, type,
            length = contexts ? contexts.length : 0,
            html = '';
        if (log.isDebugEnabled()) {
            log.debug('Including : ' + stringify(contexts));
        }
        if (length == 0) {
            return html;
        }
        type = typeof contexts;
        if (contexts instanceof Array) {
            for (i = 0; i < length; i++) {
                html += renderData(contexts[i]);
            }
        } else if (contexts instanceof String || type === 'string' ||
            contexts instanceof Number || type === 'number' ||
            contexts instanceof Boolean || type === 'boolean') {
            html = contexts.toString();
        } else {
            html = renderData(contexts);
        }
        return new Handlebars.SafeString(html);
    });

    /**
     * {{#itr context}}key : {{key}} value : {{value}}{{/itr}}
     */
    Handlebars.registerHelper("itr", function (obj, options) {
        var key, buffer = '';
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                buffer += options.fn({key: key, value: obj[key]});
            }
        }
        return buffer;
    });

    /**
     * {{#func myFunction}}{{/func}}
     */
    Handlebars.registerHelper("func", function (context, block) {
        var param,
            args = [],
            params = block.hash;
        for (param in params) {
            if (params.hasOwnProperty(param)) {
                args.push(params[param]);
            }
        }
        return block(context.apply(null, args));
    });

    /**
     * Registers  'js' handler for JavaScript inclusion within handlebars templates.
     * {{js .}}
     */
    Handlebars.registerHelper('js', function () {
        var i, url, length,
            html = '',
            theme = caramel.theme(),
            js = caramel.meta().js;
        if (!js) {
            return html;
        }
        length = js.length;
        html += meta(theme);
        if (length == 0) {
            return new Handlebars.SafeString(html);
        }
        url = theme.url;
        for (i = 0; i < length; i++) {
            //remove \n when production = true
            html += '\n' + renderJS(url.call(theme, 'js/' + js[i]));
        }
        return new Handlebars.SafeString(html);
    });

    /**
     * Registers  'css' handler for CSS inclusion within handlebars templates.
     * {{css .}}
     */
    Handlebars.registerHelper('css', function () {
        var i, url, length,
            html = '',
            theme = caramel.theme(),
            css = caramel.meta().css;
        if (!css) {
            return html;
        }
        length = css.length;
        if (length == 0) {
            return new Handlebars.SafeString(html);
        }
        url = theme.url;
        for (i = 0; i < length; i++) {
            html += renderCSS(url.call(theme, 'css/' + css[i]));
        }
        return new Handlebars.SafeString(html);
    });

    /**
     * Registers  'code' handler for JavaScript inclusion within handlebars templates.
     * {{code .}}
     */
    Handlebars.registerHelper('code', function () {
        var i, file, template, length,
            html = '',
            theme = caramel.theme(),
            meta = caramel.meta(),
            codes = meta.code;
        if (!codes) {
            return html;
        }
        length = codes.length;
        if (length == 0) {
            return html;
        }
        for (i = 0; i < length; i++) {
            file = new File(theme.resolve('code/' + codes[i]));
            file.open('r');
            template = Handlebars.compile(file.readAll());
            file.close();
            html += template(meta.data);
        }
        return new Handlebars.SafeString(html);
    });

    /**
     * Registers  'url' handler for resolving theme files.
     * {{url "js/jquery-lates.js"}}
     */
    Handlebars.registerHelper('url', function (path) {
        if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
            return path;
        }
        return caramel.url(path);
    });

    /**
     * Registers  'json' handler for serializing objects.
     * {{json data}}
     */
    Handlebars.registerHelper('json', function (obj) {
        return obj ? new Handlebars.SafeString(stringify(obj)) : null;
    });

    /**
     * Registers  'cap' handler for resolving theme files.
     * {{url "js/jquery-lates.js"}}
     */
    Handlebars.registerHelper('cap', function (str) {
        return str.replace(/[^\s]+/g, function (str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1).toLowerCase();
        });
    });

    /**
     * {{#slice start="1" end="10" count="2" size="2"}}{{name}}{{/slice}}
     */
    Handlebars.registerHelper('slice', function (context, block) {
        var html = "",
            length = context.length,
            start = parseInt(block.hash.start) || 0,
            end = parseInt(block.hash.end) || length,
            count = parseInt(block.hash.count) || length,
            size = parseInt(block.hash.size) || length,
            i = start,
            c = 0;
        while (i < end && c++ < count) {
            html += block(context.slice(i, (i += size)));
        }
        return html;
    });

    meta = function (theme) {
        var code, g,
            meta = caramel.meta(),
            config = caramel.configs();
        code = 'var caramel = caramel || {}; caramel.context = "' + config.context + '"; caramel.themer = "' + theme.name + '";';
        code += "caramel.url = function (path) { return this.context + (path.charAt(0) !== '/' ? '/' : '') + path; };";
        g = theme.engine.globals(meta.data, meta);
        code += g || '';
        return renderJS(code, true);
    };

    renderData = function (data) {
        var template,
            context = typeof data.context === 'function' ? data.context() : data.context;
        if (data.partial) {
            if (log.isDebugEnabled()) {
                log.debug('Rendering template ' + data.partial);
            }

            template = Handlebars.compile(Handlebars.partials[data.partial]);
        } else {
            if (log.isDebugEnabled()) {
                log.debug('No template, serializing data');
            }
            template = serialize;
        }
        return template(context);
    };

    serialize = function (o) {
        var type = typeof o;
        switch (type) {
            case 'string':
            case 'number':
                return o;
            default :
                return stringify(o);
        }
    };

    helpersDir = 'helpers';

    renderersDir = 'renderers';

    pagesDir = 'pages';

    partialsDir = 'partials';

    partials = function (Handlebars) {
        var theme = caramel.theme();
        (function register(prefix, file) {
            var i, length, name, files;
            if (file.isDirectory()) {
                files = file.listFiles();
                length = files.length;
                for (i = 0; i < length; i++) {
                    file = files[i];
                    register(prefix ? prefix + '.' + file.getName() : file.getName(), file);
                }
            } else {
                name = file.getName();
                if (name.substring(name.length - 4) !== '.hbs') {
                    return;
                }
                file.open('r');
                Handlebars.registerPartial(prefix.substring(0, prefix.length - 4), file.readAll());
                file.close();
            }
        })('', new File(theme.resolve(partialsDir)));
    };

    /**
     * Init function of handlebars engine. This can be overridden by new themes.
     * @param theme
     */
    init = function (theme) {
        if (log.isDebugEnabled()) {
            log.debug('Initializing engine handlebars with theme : ' + theme.name);
        }
        this.partials(Handlebars);
    };

    render = function (data, meta) {
        var fn,
            path = meta.request.getMappedPath() || meta.request.getRequestURI();
        path = caramel.theme().resolve(renderersDir + path.substring(0, path.length - 4) + '.js');
        if (log.isDebugEnabled()) {
            log.debug('Rendering data for the request using : ' + path);
        }
        if (!new File(path).isExists() || !(fn = require(path).render)) {
            print(caramel.build(data));
            return;
        }
        fn(theme, data, meta, function (path) {
            return require(caramel.theme().resolve(path));
        });
    };

    /**
     * Render function of handlebars engine. This can be overridden by new themes.
     */
    theme = function (page, context, js, css, code) {
        var file, template, path, area, blocks, helper, length, i, o,
            meta = caramel.meta();
        js = js || [];
        css = css || [];
        code = code || [];
        for (area in context) {
            if (context.hasOwnProperty(area)) {
                blocks = context[area];
                length = blocks.length;
                for (i = 0; i < length; i++) {
                    path = caramel.theme().resolve(helpersDir + '/' + blocks[i].partial + '.js');
                    if (new File(path).isExists()) {
                        helper = require(path);
                        if (helper.resources) {
                            o = helper.resources(page, meta);
                            js = o.js ? js.concat(o.js) : js;
                            css = o.css ? css.concat(o.css) : css;
                            code = o.code ? code.concat(o.code) : code;
                        }
                    }
                }
            }
        }
        meta.js = js;
        meta.css = css;
        meta.code = code;
        path = caramel.theme().resolve(pagesDir + '/' + page + '.hbs');
        if (log.isDebugEnabled()) {
            log.debug('Rendering page : ' + path);
        }
        file = new File(path);
        file.open('r');
        template = Handlebars.compile(file.readAll());
        file.close();
        print(template(context));
    };

    renderJS = function (js, inline) {
        return '<script type="application/javascript"' + (inline ? '>' + js : ' src="' + js + '">') + '</script>';
    };

    renderCSS = function (css) {
        return '<link rel="stylesheet" type="text/css" href="' + css + '"/>';
    };

    globals = function (data, meta) {
        return null;
    };

    populate = function (dir, ext, theme) {
        var i, n,
            a = [],
            files = new File(theme.resolve(dir + ext)),
            l1 = ext.length,
            l2 = files.length;
        for (i = 0; i < l2; i++) {
            n = files[i].getName();
            if (n.substring(n.length - l1) !== '.' + ext) {
                continue;
            }
            a.push(ext + '/' + n);
        }
        return a;
    };

    return {
        partials: partials,
        globals: globals,
        init: init,
        render: render
    };
})());