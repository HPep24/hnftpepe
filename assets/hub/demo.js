/**
 * demo.js
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright 2018, Codrops
 * http://www.codrops.com
 *
 * The effect is Codrops' "Menu to Inner Page Animation with Image Grid
 * Background": a list of names, and behind it a scatter of images that fly
 * out and in when the current name changes. The Grid class — the scatter,
 * the tilt, the fly-out / fly-in — is the demo's own.
 *
 * SITE MODS (HNFT PEPE). The demo was a two-step control: click a name to
 * select it, then click a small "explore" link that appeared beside it. Here
 * a row is a real link and the selection follows the pointer:
 *
 *   - hovering or focusing a name previews it; clicking it goes there. On a
 *     touch screen, where there is no hover, the first tap previews and the
 *     second goes — and the caption rail's button says so in words.
 *   - a change asked for while the previous one is still flying is queued,
 *     not dropped, so sweeping the pointer down the list ends on the right
 *     room rather than on whichever one the animation happened to allow.
 *   - previews load when their room is first shown (data-src), then the rest
 *     in the background. The page used to wait for every room's images.
 *   - the list introduces itself once, on load.
 *   - reduced motion: rooms swap in place, nothing flies.
 *   - the scatter is recomputed on resize.
 *
 * Used by index.html and the two collections pages, through HUBMENU.start()
 * (see hub-ui.js).
 */
{
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* a pointer that can hover: the mouse previews, the click goes */
    const HOVER = matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Generates a random float.
    const getRandom = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

    // from http://www.quirksmode.org/js/events_properties.html#position
    const getMousePos = (e) => {
        let posx = 0;
        let posy = 0;
        if (!e) e = window.event;
        if (e.pageX || e.pageY) 	{
            posx = e.pageX;
            posy = e.pageY;
        }
        else if (e.clientX || e.clientY) 	{
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        return { x : posx, y : posy }
    };

    // Equation of a line (y = mx + b ).
    const lineEq = (y2, y1, x2, x1, currentVal) => {
        const m = (y2 - y1) / (x2 - x1);
        const b = y1 - m * x1;
        return m * currentVal + b;
    };

    // Window sizes.
    let winsize;
    const calcWinsize = () => winsize = {width: window.innerWidth, height: window.innerHeight};
    calcWinsize();
    window.addEventListener('resize', calcWinsize);

    let allowTilt = true;

    // The size a preview sits at when it is resting in its cell. The scatter
    // maths in Grid.spread() is written against this, so change it here and
    // nowhere else -- the no-overlap guarantee is derived from it. A page may
    // set it (data-rest on .menu): beside the names (the hub's wings, and a
    // collections page with a one-column list) the art rests at .9; behind
    // the names (a two-column list) at .86. Unset, it is the demo's .62.
    let RESTSCALE = 0.62;
    // The demo's timings, scaled: a selection that follows the pointer wants
    // an answer sooner than one that waited for a click.
    const SPEED = 0.74;

    class Grid {
        constructor(el) {
            this.DOM = {el: el};
            // Some configuration values.
            this.config = {
                // The min and max values to move each item (y-axis) when we move the mouse.
                titltOffset: {min: 5, max: 40}
            };
            // Grid items.
            this.DOM.items = Array.from(this.DOM.el.querySelectorAll('.grid__item'));
            // Total items.
            this.itemsTotal = this.DOM.items.length;
            // Spread the grid items.
            this.spread();
        }
        /* SITE MOD: a room's previews are fetched when the room is first shown,
           and only the ones this window's layout draws -- a narrow window hides
           the cells past the sixth, and their files are not asked for. Safe to
           call again (after a resize has brought cells back): what has been
           fetched no longer carries data-src. */
        load() {
            this.asked = true;
            this.DOM.el.querySelectorAll('[data-src]').forEach((m) => {
                const cell = m.closest('.grid__item');
                if ( cell && getComputedStyle(cell).display === 'none' ) return;
                const src = m.getAttribute('data-src');
                m.removeAttribute('data-src');
                if ( m.tagName === 'VIDEO' ) { m.src = src; const p = m.play(); if ( p && p.catch ) p.catch(() => {}); }
                else m.src = src;
            });
        }
        spread() {
            // Scatter the grid items, but only inside their own grid cell.
            // An item is drawn at RESTSCALE, so its visible box is smaller than
            // the cell the grid gave it, leaving a margin free on every side
            // (plus half the grid gap, which belongs to nobody). Keeping the
            // offset inside that budget means an item can never wander into a
            // neighbour's cell -- and since the cells themselves don't overlap,
            // the items can never overlap either.
            const gridEl = this.DOM.el;
            const cs = getComputedStyle(gridEl);
            const gapX = parseFloat(cs.columnGap) || 0;
            const gapY = parseFloat(cs.rowGap) || 0;
            const SAFE = 4;   // hairline so rounding can't touch two boxes together
            const EDGE = 8;   // keep everything this far inside the viewport

            // Nudge a value toward the viewport, but never past the cell budget --
            // staying inside the cell is what guarantees items can't overlap, so
            // it always wins. If the cell simply can't reach the viewport, the
            // item sits dead centre in its own cell.
            const fit = (v, budget, lo, hi) => {
                const a = Math.max(-budget, lo), b = Math.min(budget, hi);
                return a > b ? 0 : Math.min(Math.max(v, a), b);
            };

            this.DOM.items.forEach((item) => {
                // The min and max values to move each item (y-axis) when we move the mouse.
                const randnum = Number(getRandom(this.config.titltOffset.min,this.config.titltOffset.max));
                item.dataset.minTy = -1*randnum;
                item.dataset.maxTy = randnum;

                // Measure the untransformed cell.
                TweenMax.set(item, {x: 0, y: 0, scale: 1});
                const rect = item.getBoundingClientRect();
                // Item's center point.
                const center = {x: rect.left+rect.width/2, y: rect.top+rect.height/2};
                // Half-size of the item once it is scaled down to RESTSCALE.
                const half = {x: rect.width*RESTSCALE/2, y: rect.height*RESTSCALE/2};

                // How far it may travel and still stay in its own cell.
                // The mouse tilt adds up to `randnum` px vertically, so pay for that too.
                const budget = {
                    x: Math.max(0, rect.width/2  - half.x + gapX/2 - SAFE),
                    y: Math.max(0, rect.height/2 - half.y + gapY/2 - SAFE - (HOVER && !RM ? randnum : 0))
                };

                let tx = Number(getRandom(-budget.x, budget.x));
                let ty = Number(getRandom(-budget.y, budget.y));

                // And stay on screen where the cell allows it.
                tx = fit(tx, budget.x, EDGE + half.x - center.x, winsize.width  - EDGE - half.x - center.x);
                ty = fit(ty, budget.y, EDGE + half.y + randnum - center.y, winsize.height - EDGE - half.y - randnum - center.y);

                // Save the current translation.
                item.dataset.ctx = tx;
                item.dataset.cty = ty;

                TweenMax.set(item, {
                    x: tx,
                    y: ty,
                    scale: RESTSCALE
                });
            });
        }
        tilt(ev) {
            if ( !allowTilt ) return;
            const mousepos = getMousePos(ev);
            // Document scrolls.
            const docScrolls = {
                left : document.body.scrollLeft + document.documentElement.scrollLeft,
                top : document.body.scrollTop + document.documentElement.scrollTop
            };
            // Mouse position relative to the main element.
            const relmousepos = {
                x : mousepos.x - docScrolls.left,
                y : mousepos.y - docScrolls.top
            };
            // Movement settings for the tilt elements.
            this.DOM.items.forEach((item) => {
                TweenMax.to(item, 4, {
                    ease: Quint.easeOut,
                    y: Number(item.dataset.cty) + lineEq(item.dataset.maxTy,item.dataset.minTy,winsize.height,0,relmousepos.y)
                });
            });
        }
        hideItems(direction) {
            return this.toggleItems('hide', direction);
        }
        showItems(direction) {
            this.load();
            return this.toggleItems('show', direction);
        }
        toggleItems(action, direction) {
            return new Promise((resolve, reject) => {
                /* SITE MOD: reduced motion -- the room's previews change places
                   with the last room's, and that is all. */
                if ( RM ) {
                    this.DOM.items.forEach((item) => {
                        TweenMax.killTweensOf(item);
                        TweenMax.set(item, {x: item.dataset.ctx, y: item.dataset.cty, scaleX: RESTSCALE, scaleY: RESTSCALE,
                                            opacity: action === 'show' ? 1 : 0});
                    });
                    resolve();
                    return;
                }
                let cnt = 0;
                this.DOM.items.forEach((item) => {
                    const rect = item.getBoundingClientRect();

                    // The speed and delay will depend on how much the item can be translated when moving the mouse (this.config.titltOffset).
                    // This will result in some items moving faster than others and also starting at different times.
                    const speed = SPEED * lineEq(1.3,0.9,this.config.titltOffset.min,this.config.titltOffset.max,item.dataset.maxTy);
                    const delay = SPEED * lineEq(0,0.4,this.config.titltOffset.min,this.config.titltOffset.max,item.dataset.maxTy);

                    TweenMax.to(item, speed, {
                        ease: Expo.easeInOut,
                        delay: delay,
                        startAt: action === 'show' ? {y: direction === 'up' ? `+=${winsize.height + rect.height}` : `-=${winsize.height + rect.height}`, opacity:1} : null,
                        y: action === 'show' ? item.dataset.cty :
                            direction === 'up' ? `-=${winsize.height + rect.height}` : `+=${winsize.height + rect.height}`
                    });

                    TweenMax.to(item, action === 'show' ? speed*.55 : speed*.45, {
                        ease: action === 'show' ? Quad.easeIn : Expo.easeIn,
                        delay: delay,
                        scaleX: RESTSCALE*0.9,
                        scaleY: RESTSCALE*getRandom(1.6,2.1),   // the demo's 1 to 1.3, against its .62
                        opacity: 0.5,
                        onComplete: () => {
                            TweenMax.to(item, action === 'show' ? speed*.45 : speed*.55, {
                                ease: action === 'show' ? Expo.easeOut : Quad.easeOut,
                                scaleX: RESTSCALE,
                                scaleY: RESTSCALE,
                                opacity: 1,
                                onComplete: () => {
                                    if ( action === 'hide' ) {
                                        TweenMax.set(item, {opacity: 0, y: item.dataset.cty});
                                    }
                                    cnt++;
                                    if ( this.itemsTotal === cnt ) {
                                        resolve();
                                    }
                                }
                            });
                        }
                    });
                });
                if ( !this.itemsTotal ) resolve();
            });
        }
    }

    class MenuItem {
        constructor(el) {
            this.DOM = {el: el};
            this.DOM.textwrap = this.DOM.el.querySelector('.menu__item-textwrap');
            this.DOM.text = this.DOM.textwrap.querySelector('.menu__item-text');
        }
        setCurrent(on) {
            /* the row that is filled in is the one the caption describes. A
               class and nothing more: aria-current would tell a screen reader
               that the visitor IS in the room a pointer happens to rest on */
            this.DOM.el.classList.toggle('menu__item--current', on);
        }
        // Slide the name up into its row.
        show(delay) {
            if ( RM ) { TweenMax.set(this.DOM.text, {y: '0%'}); return; }
            TweenMax.to(this.DOM.text, 1, {
                ease: Expo.easeInOut,
                delay: delay || 0,
                startAt: {y: '103%'},
                y: '0%'
            });
        }
	}

    class NavController {
        constructor(el, opts) {
            this.DOM = {menu: el}; // Initialize with the menu element.
            this.opts = opts || {};
            // The Menu items instances.
            this.menuItems = [];
            Array.from(this.DOM.menu.querySelectorAll('.menu__item')).forEach((item) => this.menuItems.push(new MenuItem(item)));
            // The page element (the grids parent)
            this.DOM.page = document.querySelector('.page');
            // The grid´s wrap.
            this.DOM.gridWrap = this.DOM.page.querySelector('.gridwrap');
            // The grid instances.
            this.grids = [];
            Array.from(this.DOM.gridWrap.querySelectorAll('.grid')).forEach((grid) => this.grids.push(new Grid(grid)));
            this.init();
        }
        init() {
            // Current nav menu item index (starting with the first one).
            this.current = 0;
            this.pending = null;
            this.menuItems[this.current].setCurrent(true);
            // Until intro() runs the names wait below their rows.
            if ( !RM ) this.menuItems.forEach((item) => TweenMax.set(item.DOM.text, {y: '103%'}));
            this.initEvents();
        }
        /* SITE MOD: the one orchestrated moment. The names rise into their rows
           one after another while the first room's previews fly in behind. */
        intro() {
            if ( this.introduced ) return;
            this.introduced = true;
            this.menuItems.forEach((item, i) => item.show(i * 0.045));
            if ( !this.grids[this.current] ) return;
            this.isAnimating = true;
            allowTilt = false;
            this.grids[this.current].showItems('up').then(() => this.settle());
        }
        settle() {
            this.isAnimating = false;
            allowTilt = true;
            /* whatever was asked for while this one was still flying */
            if ( this.pending !== null && this.pending !== this.current ) {
                const p = this.pending; this.pending = null;
                this.navigate(p);
            } else this.pending = null;
        }
        initEvents() {
            // Move the current grid´s items on the y-axis as the user moves the mouse.
            if ( HOVER && !RM ) {
                this.mousemoveFn = (ev) => requestAnimationFrame(() => { if ( this.grids[this.current] ) this.grids[this.current].tilt(ev); });
                window.addEventListener('mousemove', this.mousemoveFn);
            }

            let intent = null;
            for (const [pos, item] of this.menuItems.entries()) {
                const el = item.DOM.el;
                if ( HOVER ) {
                    /* a beat of intent, so a pointer merely crossing the list
                       on its way somewhere else does not set five rooms flying */
                    el.addEventListener('mouseenter', () => { clearTimeout(intent); intent = setTimeout(() => this.navigate(pos), 90); });
                    el.addEventListener('mouseleave', () => clearTimeout(intent));
                }
                el.addEventListener('focus', () => this.navigate(pos));
                /* With a mouse the click simply follows the link. Without one
                   there has been no hover to preview the room, so the first tap
                   selects it and the second -- or the caption's button -- goes.
                   What counts is which room was showing when the finger came
                   DOWN: a tap focuses the link before it clicks it, and the
                   focus handler above has already made this row current by the
                   time the click arrives. A click with no pointer before it is
                   the keyboard's Enter, and simply goes. */
                el.addEventListener('pointerdown', () => { clearTimeout(this.downT); this.downOn = this.shown(); });
                /* a press that ends without a click (it became a scroll, or
                   slid off the row) must not be remembered: the next Enter
                   from a keyboard would be taken for the second half of it */
                const forget = () => { clearTimeout(this.downT); this.downT = setTimeout(() => { this.downOn = undefined; }, 700); };
                el.addEventListener('pointerup', forget);
                el.addEventListener('pointercancel', forget);
                el.addEventListener('pointerleave', forget);
                el.addEventListener('click', (ev) => {
                    const before = this.downOn;
                    clearTimeout(this.downT);
                    this.downOn = undefined;
                    if ( HOVER || before === undefined || before === pos ) return;
                    ev.preventDefault();
                    this.navigate(pos);
                });
            }

            // The scatter is measured against the window: measure it again when that changes.
            let rz = null;
            const again = () => {
                clearTimeout(rz);
                rz = setTimeout(() => {
                    /* mid-flight the tiles are not where they rest: wait for the landing */
                    if ( this.isAnimating ) { again(); return; }
                    this.grids.forEach((grid, i) => {
                        grid.spread();
                        TweenMax.set(grid.DOM.items, {opacity: i === this.current && this.introduced ? 1 : 0});
                        /* cells the wider layout has brought back */
                        if ( grid.asked ) grid.load();
                    });
                }, 180);
            };
            window.addEventListener('resize', again);
        }
        /* the room the visitor is being shown, or about to be */
        shown() { return this.pending !== null ? this.pending : this.current; }
        navigate(pos) {
            if ( pos === this.shown() ) return;
            /* The row and the caption answer at once; the previews follow when
               the last flight has landed. */
            this.menuItems.forEach((item, i) => item.setCurrent(i === pos));
            if ( this.opts.onChange ) this.opts.onChange(pos, this.menuItems[pos].DOM.el);
            if ( this.isAnimating || !this.introduced ) { this.pending = pos; return; }
            if ( pos === this.current ) return;

            const direction = this.current < pos ? 'up' : 'down';
            this.isAnimating = true;
            // Disable the mousemove functionality.
            allowTilt = false;
            // Hide the current grid items.
            if ( this.grids[this.current] ) this.grids[this.current].hideItems(direction);
            // Update current value.
            this.current = pos;
            // Show the next grid items.
            if ( this.grids[this.current] ) this.grids[this.current].showItems(direction).then(() => this.settle());
            else this.settle();
        }
    }

    /* SITE MOD: the page starts the effect, once its fonts and first previews
       are ready (hub-ui.js). */
    window.HUBMENU = {
        start(opts) {
            const menu = document.querySelector('.menu');
            if ( !menu ) return null;
            const rest = parseFloat(menu.getAttribute('data-rest'));
            if ( rest > 0 && rest <= 1 ) RESTSCALE = rest;
            return new NavController(menu, opts);
        },
        RM: RM, HOVER: HOVER
    };
}
