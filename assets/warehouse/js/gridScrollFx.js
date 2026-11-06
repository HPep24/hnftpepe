/**
 * gridScrollFx.js v1.0.0
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright 2013, Codrops
 * http://www.codrops.com
 *
 * SITE MODS (HNFT PEPE) — all marked below:
 *   - no Modernizr, no classie: CSS animations and classList are universal now,
 *     and the two libraries were ~10 KB of render-blocking script per wall;
 *   - a tile's media may be a <video> as well as an <img>;
 *   - animateOnLoad and curtainRamp options;
 *   - `sized` mode: a wall whose tiles declare their dimensions is laid out at
 *     once and each tile is revealed when ITS OWN picture has arrived, instead
 *     of the whole wall waiting on the slowest file.
 */
;( function( window ) {

	'use strict';

	var docElem = window.document.documentElement;

	function getViewportH() {
		var client = docElem['clientHeight'],
			inner = window['innerHeight'];

		if( client < inner )
			return inner;
		else
			return client;
	}

	function scrollY() {
		return window.pageYOffset || docElem.scrollTop;
	}

	// http://stackoverflow.com/a/5598797/989439
	function getOffset( el ) {
		var offsetTop = 0, offsetLeft = 0;
		do {
			if ( !isNaN( el.offsetTop ) ) {
				offsetTop += el.offsetTop;
			}
			if ( !isNaN( el.offsetLeft ) ) {
				offsetLeft += el.offsetLeft;
			}
		} while( el = el.offsetParent )

		return {
			top : offsetTop,
			left : offsetLeft
		}
	}

	function inViewport( el, h ) {
		var elH = el.offsetHeight,
			scrolled = scrollY(),
			viewed = scrolled + getViewportH(),
			elTop = getOffset(el).top,
			elBottom = elTop + elH,
			// if 0, the element is considered in the viewport as soon as it enters.
			// if 1, the element is considered in the viewport only when it's fully inside
			// value in percentage (1 >= h >= 0)
			h = h || 0;

		return (elTop + elH * h) <= viewed && (elBottom - elH * h) >= scrolled;
	}

	function extend( a, b ) {
		for( var key in b ) {
			if( b.hasOwnProperty( key ) ) {
				a[key] = b[key];
			}
		}
		return a;
	}

	function GridItem( el, options ) {
		this.el = el;
		this.options = options || {};
		this.anchor = el.querySelector( 'a' )
		/* SITE MOD: a tile's media may be a <video> as well as an <img> -- one
		   piece in the UTXO wall is an mp4. Everything downstream (the curtain,
		   the animation delay, the shown/animate classes) is element-agnostic;
		   only ColorFinder is not, and it is guarded below. */
		this.image = el.querySelector( 'a > img, a > video' );
		this.desc = el.querySelector( 'h3' );
	}

	/* SITE MOD: has this tile's picture arrived? A video shows its poster and a
	   tile with no media has nothing to wait for, so both are always ready. An
	   image that failed is "ready" too -- its tile reveals whatever the error
	   handler swapped in, or the alt text, rather than hanging for ever. */
	GridItem.prototype.ready = function() {
		var im = this.image;
		if( !im ) return true;
		/* a film is ready when its poster is: revealed sooner, the curtain
		   would lift on an empty box */
		if( im.tagName !== 'IMG' ) return this.posterPending !== true;
		/* still holding its placeholder: the real file has not been asked for */
		if( im.hasAttribute( 'data-src' ) ) return false;
		return im.complete || this.failed === true;
	}

	/* SITE MOD: fold the artwork's dominant colour onto the room's noir ramp,
	   so light art yields a light curtain and dark art a dark one -- in the
	   room's own ink. curtainRamp is [ [r,g,b] shadow, [r,g,b] highlight ].

	   ColorFinder samples a loaded <img> through a canvas. A <video> has no
	   pixels to read at this point, a cross-origin image taints the canvas, and
	   an <img> that failed to load makes drawImage throw InvalidStateError --
	   stock, that exception escaped, aborted the loop building the items, and
	   left every tile after the broken one with no curtain at all. Each of those
	   now costs only its own tile's tint. */
	GridItem.prototype.tint = function() {
		if( !this.curtain || !this.image || this.image.tagName !== 'IMG' ) return;
		var rgb = {};
		try {
			rgb = new ColorFinder( function favorHue(r,g,b) {
				return (Math.abs(r-g)*Math.abs(r-g) + Math.abs(r-b)*Math.abs(r-b) + Math.abs(g-b)*Math.abs(g-b))/65535*50+1;
			} ).getMostProminentColor( this.image ) || {};
		} catch( e ) { rgb = {}; }
		if( rgb.r && rgb.g && rgb.b ) {
			var _ramp = this.options.curtainRamp || [[0x14,0x12,0x1A],[0xC6,0xC1,0xD2]],
				_l = (0.2126*rgb.r + 0.7152*rgb.g + 0.0722*rgb.b) / 255,
				_sh = _ramp[0], _hi = _ramp[1],
				_n = _sh.map(function(v,i){ return Math.round(v + (_hi[i]-v)*_l); });
			this.curtain.style.background = 'rgb('+_n[0]+','+_n[1]+','+_n[2]+')';
		}
	}

	GridItem.prototype.addCurtain = function( tintNow ) {
		if( !this.image ) return;
		this.curtain = document.createElement( 'div' );
		this.curtain.className = 'curtain';
		if( tintNow !== false ) this.tint();
		this.anchor.appendChild( this.curtain );
	}

	GridItem.prototype.changeAnimationDelay = function( time ) {
		if( this.curtain ) {
			this.curtain.style.animationDelay = time + 'ms';
		}
		if( this.image ) {
			this.image.style.animationDelay = time + 'ms';
		}
		if( this.desc ) {
			this.desc.style.animationDelay = time + 'ms';
		}
	}

	function GridScrollFx( el, options ) {
		this.el = el;
		this.options = extend( {}, this.options );
		extend( this.options, options );
		this._init();
	}

	GridScrollFx.prototype.options = {
		// Minimum and maximum delay of the animation (random value is chosen)
		minDelay : 0,
		maxDelay : 500,
		// The viewportFactor defines how much of the appearing item has to be visible in order for the animation to start
		// if we'd use a value of 0, this would mean that it would add the animation class as soon as the item is in the viewport.
		// If we were to use the value of 1, the animation would only be triggered when we see all of the item in the viewport (100% of it)
		viewportFactor : 0,
		/* SITE MOD (all three default to the stock behaviour) */
		// play the curtain for tiles that are already on screen at load
		animateOnLoad : false,
		// [ [r,g,b] shadow, [r,g,b] highlight ] — the ramp the artwork's
		// dominant colour is folded onto. null = THE DEPOT's plum-grey.
		curtainRamp : null,
		// every tile's media carries width + height, so the wall can be laid
		// out before a single file has arrived
		sized : false
	}

	/* SITE MOD: the tiles are placed once, from the heights they have at that
	   moment -- and a caption stands under each picture and is part of that
	   height. On a slow line the web font arrives after the wall has been laid
	   out; a caption that then sets on another number of lines changes its
	   tile's height, and the tile under it would be left overlapped (or with a
	   hole above it). So a wall is laid out again when the fonts have come,
	   and whenever more of them come later. */
	function whenFontsCome( fn ) {
		if( !document.fonts ) return;
		if( document.fonts.ready && document.fonts.ready.then ) document.fonts.ready.then( fn, function() {} );
		if( document.fonts.addEventListener ) document.fonts.addEventListener( 'loadingdone', fn );
	}

	GridScrollFx.prototype._init = function() {
		var self = this, items = [];

		[].slice.call( this.el.children ).forEach( function( el, i ) {
			var item = new GridItem( el, self.options );
			items.push( item );
		} );

		this.items = items;
		this.itemsCount = this.items.length;
		this.itemsRenderedCount = 0;
		this.didScroll = false;

		function bindScroll() {
			var onScrollFn = function() {
				if( !self.didScroll ) {
					self.didScroll = true;
					setTimeout( function() { self._scrollPage(); }, self.options.sized ? 90 : 200 );
				}

				if( self.itemsRenderedCount === self.itemsCount ) {
					window.removeEventListener( 'scroll', onScrollFn, false );
				}
			}

			// animate the items inside the viewport (on scroll)
			window.addEventListener( 'scroll', onScrollFn, { passive: true } );
			// check if new items are in the viewport after a resize
			window.addEventListener( 'resize', function() { self._resizeHandler(); }, false );
		}

		/* SITE MOD: `sized`.
		   Stock, the grid is display:none until imagesLoaded has seen every
		   file -- and imagesLoaded pulls each one through a proxy Image, so
		   loading="lazy" on the tiles did nothing: a 96-tile wall fetched all
		   43 MB before it drew a single piece. With dimensions on every tile
		   masonry needs no file to measure, so the wall is laid out at once,
		   the browser lazy-loads what scrolls near, and a tile's curtain drops
		   when that tile's own picture has landed. */
		if( this.options.sized ) {
			this.el.classList.add( 'loaded' );
			this.masonry = new Masonry( this.el, {
				itemSelector : 'li',
				isFitWidth : true,
				transitionDuration : 0
			} );
			/* A tile may carry its file in data-src, holding a placeholder of the
			   right shape until it nears the viewport. loading="lazy" would do
			   the same job, but each browser picks its own distance -- Chrome
			   reaches 1250px to 2500px ahead -- and on a wall of multi-megabyte
			   GIFs that is the difference between 6 MB and 15 MB up front. */
			var io = ( 'IntersectionObserver' in window ) ? new IntersectionObserver( function( entries ) {
					entries.forEach( function( en ) {
						if( !en.isIntersecting ) return;
						io.unobserve( en.target );
						swapIn( en.target );
					} );
				}, { rootMargin : '700px 0px' } ) : null,
				swapIn = function( im ) {
					var src = im.getAttribute( 'data-src' );
					if( !src ) return;
					im.removeAttribute( 'data-src' );
					im.src = src;
				};
			var kick = null, relay = null,
				check = function() {
					if( kick ) return;
					kick = requestAnimationFrame( function() { kick = null; self._scrollPage(); } );
				},
				relayout = function() {
					clearTimeout( relay );
					relay = setTimeout( function() { self.masonry.layout(); check(); }, 80 );
				};
			whenFontsCome( relayout );
			this.items.forEach( function( item ) {
				if( !item.image ) return;
				item.addCurtain( false );
				item.el.classList.add( 'pending' );
				item.changeAnimationDelay( Math.random() * ( self.options.maxDelay - self.options.minDelay ) + self.options.minDelay );
				if( item.image.tagName === 'IMG' ) {
					item.image.addEventListener( 'load', function() {
						/* The declared size is a promise the file may not keep (a
						   catalog entry describing the piece rather than this
						   picture of it), and a tile may declare none at all.
						   Either way the tile has just changed height, so the
						   columns are laid out again -- rarely, and only when a
						   tile was wrong. */
						var im = item.image, dw = +im.getAttribute( 'width' ), dh = +im.getAttribute( 'height' );
						if( !dw || !dh || ( im.naturalWidth && im.naturalHeight &&
							Math.abs( dw / dh - im.naturalWidth / im.naturalHeight ) > 0.02 ) ) relayout();
						check();
					} );
					item.image.addEventListener( 'error', function() {
						/* a page's own error handler may swap in a fallback file;
						   give that one chance to land before giving up on the tile */
						setTimeout( function() {
							var im = item.image;
							if( im.complete && im.naturalWidth ) return;      /* the fallback made it */
							if( !im.complete ) return;                        /* still trying: its own load / error will report */
							/* nothing came. Hold the tile's shape and say so, rather
							   than leave a broken-image glyph on the wall. */
							var dw = +im.getAttribute( 'width' ), dh = +im.getAttribute( 'height' );
							if( dw && dh ) item.anchor.style.aspectRatio = dw + ' / ' + dh;
							item.el.classList.add( 'is-missing' );
							item.failed = true;
							relayout();
						}, 1200 );
					} );
					if( item.image.hasAttribute( 'data-src' ) ) {
						if( io ) io.observe( item.image ); else swapIn( item.image );
					}
				}
				else if( item.image.poster ) {
					item.posterPending = true;
					var pi = new Image();
					pi.onload = pi.onerror = function() { item.posterPending = false; check(); };
					pi.src = item.image.poster;
				}
			} );
			bindScroll();
			setTimeout( function() { self._scrollPage(); }, 60 );
			return;
		}

		imagesLoaded( this.el, function() {
			// show grid
			self.el.classList.add( 'loaded' );

			// initialize masonry
			self.masonry = new Masonry( self.el, {
				itemSelector : 'li',
				isFitWidth : true,
				transitionDuration : 0
			} );

			/* SITE MOD: laid out again when the fonts have come (see
			   whenFontsCome, above) -- this wall too, not only the sized ones */
			var again = null;
			whenFontsCome( function() {
				clearTimeout( again );
				again = setTimeout( function() { self.masonry.layout(); self._scrollPage(); }, 80 );
			} );

			// the items already shown...
			self.items.forEach( function( item ) {
				/* SITE MOD: stock behaviour marks anything already on screen as
				   `shown` with no curtain — correct for a long page you scroll
				   into, wrong for a room whose whole collection fits above the
				   fold, where it means the effect never plays at all.
				   animateOnLoad curtains every tile instead. */
				if( !self.options.animateOnLoad && inViewport( item.el ) ) {
					++self.itemsRenderedCount;
					item.el.classList.add( 'shown' );
				}
				else {
					item.addCurtain();
					// add random delay
					item.changeAnimationDelay( Math.random() * ( self.options.maxDelay - self.options.minDelay ) + self.options.minDelay );
				}
			} );

			/* SITE MOD: one frame later, so every curtain is in the DOM and
			   painted before the animation class lands. Applied in the same
			   frame the elements are created, the first paint is already the
			   finished state and nothing appears to move. */
			if( self.options.animateOnLoad ) {
				setTimeout( function() { self._scrollPage(); }, 60 );
			}

			bindScroll();
		});
	}

	GridScrollFx.prototype._scrollPage = function() {
		var self = this;
		this.items.forEach( function( item ) {
			var cl = item.el.classList;
			if( !cl.contains( 'shown' ) && !cl.contains( 'animate' ) && inViewport( item.el, self.options.viewportFactor ) ) {
				/* SITE MOD: in a sized wall a tile waits for its own picture */
				if( self.options.sized && !item.ready() ) return;

				++self.itemsRenderedCount;
				cl.remove( 'pending' );

				if( !item.curtain ) {
					cl.add( 'shown' );
					return;
				};

				if( self.options.sized ) item.tint();
				cl.add( 'animate' );

				// after animation ends add class shown
				var onEndAnimationFn = function( ev ) {
					/* the curtain's ::after fades on the same clock and reports
					   its animationend on this element too -- only the curtain's
					   own end finishes the tile */
					if( ev && ( ev.target !== item.curtain || ev.pseudoElement ) ) return;
					item.curtain.removeEventListener( 'animationend', onEndAnimationFn );
					cl.remove( 'animate' );
					cl.add( 'shown' );
				};
				item.curtain.addEventListener( 'animationend', onEndAnimationFn );
			}
		});
		this.didScroll = false;
	}

	GridScrollFx.prototype._resizeHandler = function() {
		var self = this;
		function delayed() {
			self._scrollPage();
			self.resizeTimeout = null;
		}
		if ( this.resizeTimeout ) {
			clearTimeout( this.resizeTimeout );
		}
		this.resizeTimeout = setTimeout( delayed, 1000 );
	}

	/* SITE MOD: an empty picture of the right shape, for a tile whose real file
	   waits in data-src. It gives the <img> a true intrinsic ratio in every
	   browser, so the column is laid out correctly before the file is asked for. */
	GridScrollFx.placeholder = function( w, h ) {
		return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 '
			+ ( +w || 1 ) + ' ' + ( +h || 1 ) + '%22/%3E';
	}

	// add to global namespace
	window.GridScrollFx = GridScrollFx;

} )( window );
