(function (window) {
  const magnifier = new HTMLMagnifier({ width: 400 });
  magnifier.show();
  function HTMLMagnifier(options) {
    const _this = this;

    // Merge default options with user options
    _this.options = Object.assign({
      zoom: 2,
      minZoom: 1,
      maxZoom: 5,
      zoomStep: 0.5,
      width: 200,
      height: 250,
      fixedPosition: { top: 20, right: 20 },
      showControls: true
    }, options);

    // DOM elements
    let magnifier, magnifierContent, magnifierGlass, magnifierControls, zoomInBtn, zoomOutBtn, zoomLevelDisplay;
    let magnifierBody;

    // State variables
    let isVisible = false;
    let isDragging = false;
    let observerObj;
    let syncTimeout;
    let mousePosition = { x: 0, y: 0 };
    let events = {};

    // HTML template
    const magnifierTemplate = `
      <div class="magnifier" style="display: none;position: fixed; box-shadow: rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px; overflow: hidden;background-color: white;border: 1px solid #555;border-radius: 4px;z-index:10000;">
        <div class="magnifier-content" style="top: 0px;left: 0px;margin-left: 0px;margin-top: 0px;overflow: visible;position: absolute;display: block;transform-origin: left top;user-select: none;padding-top: 0px"></div>
        <div class="magnifier-glass" style="position: absolute;top: 0px;left: 0px;width: 100%;height: 100%;opacity: 0.0;background-color: white;cursor: move;"></div>
        <div class="magnifier-controls" style="position: absolute;bottom: 5px;left: 5px;right: 5px;height: 30px;background-color: rgba(0,0,0,0.5);border-radius: 3px;display: flex;align-items: center;justify-content: space-between;padding: 0 10px;z-index:10001;">
          <button class="zoom-out" style="background: none;border: none;color: white;font-size: 16px;cursor: pointer;width: 24px;height: 24px;display: flex;align-items: center;justify-content: center;">−</button>
          <div class="zoom-level" style="color: white;font-size: 12px;"></div>
          <button class="zoom-in" style="background: none;border: none;color: white;font-size: 16px;cursor: pointer;width: 24px;height: 24px;display: flex;align-items: center;justify-content: center;">+</button>
        </div>
      </div>`;

    // Helper Functions
    function setPosition(element, left, top) {
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    }

    function setDimensions(element, width, height) {
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
    }

    function isDescendant(parent, child) {
      let node = child;
      while (node) {
        if (node === parent) return true;
        node = node.parentNode;
      }
      return false;
    }

    function triggerEvent(event, data) {
      const handlers = events[event];
      if (handlers) {
        handlers.forEach(handler => handler.call(_this, data));
      }
    }

    // Core functionality
    function setupMagnifier() {
      // Set position based on options
      const pos = _this.options.fixedPosition;
      if (pos.top !== undefined) magnifier.style.top = `${pos.top}px`;
      if (pos.right !== undefined) {
        magnifier.style.right = `${pos.right}px`;
        magnifier.style.left = 'auto';
      }
      if (pos.bottom !== undefined) {
        magnifier.style.bottom = `${pos.bottom}px`;
        magnifier.style.top = 'auto';
      }
      if (pos.left !== undefined) magnifier.style.left = `${pos.left}px`;

      // Set dimensions and shape
      setDimensions(magnifier, _this.options.width, _this.options.height);

      // Update zoom display
      zoomLevelDisplay.textContent = `${Math.round(_this.options.zoom * 100)}%`;

      // Apply zoom transform
      magnifierContent.style.transform = `scale(${_this.options.zoom})`;

      // Show/hide controls
      magnifierControls.style.display = _this.options.showControls ? 'flex' : 'none';
    }

    function updateMagnifiedArea() {
      if (!isVisible || isDragging) return;

      // Calculate the position to center the mouse position
      const centerX = _this.options.width / 2;
      const centerY = _this.options.height / 2;

      // Get scroll offsets
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

      const x = scrollLeft + mousePosition.x;
      const y = scrollTop + mousePosition.y;

      // Position content
      const contentLeft = -x * _this.options.zoom + centerX;
      const contentTop = -y * _this.options.zoom + centerY;

      setPosition(magnifierContent, contentLeft, contentTop);
      triggerEvent('viewPortChanged', magnifierBody);
    }

    function removeSelectors(container, selector) {
      const elements = container.querySelectorAll(selector);
      elements.forEach(el => el.parentNode.removeChild(el));
    }

    function prepareContent() {
      magnifierContent.innerHTML = '';

      // Clone the body
      const bodyOriginal = document.documentElement;
      const bodyCopy = bodyOriginal.cloneNode(true);

      // Match background color
      const color = bodyOriginal.style.backgroundColor;
      if (color) magnifier.style.backgroundColor = color;

      // Configure clone
      bodyCopy.style.cursor = 'auto';
      bodyCopy.style.paddingTop = '0px';
      bodyCopy.setAttribute('unselectable', 'on');

      // Copy canvas content if present
      const canvasOriginal = bodyOriginal.querySelectorAll('canvas');
      const canvasCopy = bodyCopy.querySelectorAll('canvas');
      if (canvasOriginal.length > 0 && canvasOriginal.length === canvasCopy.length) {
        for (let i = 0; i < canvasOriginal.length; i++) {
          try {
            const ctx = canvasCopy[i].getContext('2d');
            ctx.drawImage(canvasOriginal[i], 0, 0);
          } catch (error) {
            // Ignore errors
          }
        }
      }

      // Remove unwanted elements
      ['script', 'audio', 'video', '.magnifier'].forEach(selector => {
        removeSelectors(bodyCopy, selector);
      });

      triggerEvent('prepareContent', bodyCopy);
      magnifierContent.appendChild(bodyCopy);

      // Set dimensions
      setDimensions(magnifierContent, document.body.clientWidth, document.body.clientHeight);
      magnifierBody = magnifierContent.querySelector('body');
      triggerEvent('contentUpdated', magnifierBody);
    }

    function syncScroll(ctrl) {
      if (!ctrl.getAttribute) {
        if (ctrl === document) {
          updateMagnifiedArea();
        }
        return false;
      }

      const selectors = [];
      if (ctrl.getAttribute('id')) {
        selectors.push('#' + ctrl.getAttribute('id'));
      }
      if (ctrl.className) {
        selectors.push('.' + ctrl.className.split(' ').join('.'));
      }

      for (let i = 0; i < selectors.length; i++) {
        const targets = magnifierBody.querySelectorAll(selectors[i]);
        if (targets.length === 1) {
          targets[0].scrollTop = ctrl.scrollTop;
          targets[0].scrollLeft = ctrl.scrollLeft;
          return true;
        }
      }
      return false;
    }

    function syncScrollBars(e) {
      if (!isVisible) return;

      if (e && e.target) {
        syncScroll(e.target);
      } else {
        // Find all scrolled elements
        const scrolled = Array.from(document.querySelectorAll('div'))
          .filter(el => el.scrollTop > 0 && !isDescendant(magnifier, el));

        scrolled.forEach(el => syncScroll(el));
      }

      triggerEvent('syncScrollBars', magnifierBody);
    }

    // DOM observation
    function domChanged() {
      if (isVisible) {
        window.clearTimeout(syncTimeout);
        syncTimeout = window.setTimeout(syncContent, 100);
      }
    }

    function bindDOMObserver() {
      const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

      if (MutationObserver) {
        observerObj = new MutationObserver(mutations => {
          for (let i = 0; i < mutations.length; i++) {
            if (!isDescendant(magnifier, mutations[i].target)) {
              try {
                triggerEvent('checkMutation', mutations[i]);
                domChanged();
                break;
              } catch (error) {
                // Ignore errors
              }
            }
          }
        });

        observerObj.observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'width', 'height', 'style'],
          attributeOldValue: true
        });
      } else if (document.addEventListener) {
        document.addEventListener('DOMNodeInserted', domChanged, false);
        document.addEventListener('DOMNodeRemoved', domChanged, false);
      }
    }

    document.addEventListener("DOMContentLoaded", () => {
      const formContainer = document.body; // Or a more specific parent container
      formContainer.addEventListener("input", prepareContent);
      formContainer.addEventListener("change", prepareContent);
      formContainer.addEventListener("click", prepareContent);
    });

    /*   let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          console.log("DOM changed:", mutation);
        });
      });
      const config = { childList: true, subtree: true, attributes: true };
      observer.observe(document,config) */

    function unBindDOMObserver() {
      if (observerObj) {
        observerObj.disconnect();
        observerObj = null;
      }
      if (document.removeEventListener) {
        document.removeEventListener('DOMNodeInserted', domChanged, false);
        document.removeEventListener('DOMNodeRemoved', domChanged, false);
      }
    }

    function syncContent() {
      if (isVisible) {
        prepareContent();
        updateMagnifiedArea();
        syncScrollBars();
      }
    }

    // Event handlers
    function makeDraggable(ctrl) {
      let dragObject = null;
      let pos_x, pos_y, ofs_x, ofs_y;

      function downHandler(e) {
        isDragging = true;
        dragObject = ctrl;

        const pageX = e.pageX || (e.touches && e.touches[0].pageX);
        const pageY = e.pageY || (e.touches && e.touches[0].pageY);

        ofs_x = dragObject.getBoundingClientRect().left - dragObject.offsetLeft;
        ofs_y = dragObject.getBoundingClientRect().top - dragObject.offsetTop;

        pos_x = pageX - (dragObject.getBoundingClientRect().left + document.body.scrollLeft);
        pos_y = pageY - (dragObject.getBoundingClientRect().top + document.body.scrollTop);

        // Reset right/bottom properties
        dragObject.style.right = 'auto';
        dragObject.style.bottom = 'auto';

        e.preventDefault();
      }

      function moveHandler(e) {
        if (dragObject !== null) {
          const pageX = e.pageX || (e.touches && e.touches[0].pageX);
          const pageY = e.pageY || (e.touches && e.touches[0].pageY);

          if (pageX && pageY) {
            const left = pageX - pos_x - ofs_x - document.body.scrollLeft;
            const top = pageY - pos_y - ofs_y - document.body.scrollTop;

            setPosition(dragObject, left, top);
          }
        }
      }

      function upHandler() {
        if (dragObject !== null) {
          dragObject = null;
          setTimeout(() => {
            isDragging = false;
            updateMagnifiedArea();
          }, 100);
        }
      }

      // Mouse events
      magnifierGlass.addEventListener('mousedown', downHandler);
      magnifierGlass.addEventListener('touchstart', downHandler);

      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('touchmove', moveHandler);

      window.addEventListener('mouseup', upHandler);
      window.addEventListener('touchend', upHandler);
    }

    function trackMouse(e) {
      if (isVisible && !isDragging) {
        mousePosition.x = e.clientX;
        mousePosition.y = e.clientY;
        updateMagnifiedArea();
      }
    }

    function setupZoomControls() {
      // Zoom in button
      zoomInBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (_this.options.zoom < _this.options.maxZoom) {
          _this.setZoom(_this.options.zoom + _this.options.zoomStep);
        }
      });

      // Zoom out button
      zoomOutBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (_this.options.zoom > _this.options.minZoom) {
          _this.setZoom(_this.options.zoom - _this.options.zoomStep);
        }
      });

      // Prevent dragging on controls
      magnifierControls.addEventListener('mousedown', e => {
        e.stopPropagation();
      });

      // Mouse wheel zoom
      magnifier.addEventListener('wheel', e => {
        e.preventDefault();
        if (e.deltaY < 0 && _this.options.zoom < _this.options.maxZoom) {
          _this.setZoom(_this.options.zoom + _this.options.zoomStep);
        } else if (e.deltaY > 0 && _this.options.zoom > _this.options.minZoom) {
          _this.setZoom(_this.options.zoom - _this.options.zoomStep);
        }
      }, { passive: false });
    }

    // Initialize
    function init() {
      // Create DOM elements
      const div = document.createElement('div');
      div.innerHTML = magnifierTemplate;
      magnifier = div.querySelector('.magnifier');
      document.body.appendChild(magnifier);

      // Get references to elements
      magnifierContent = magnifier.querySelector('.magnifier-content');
      magnifierGlass = magnifier.querySelector('.magnifier-glass');
      magnifierControls = magnifier.querySelector('.magnifier-controls');
      zoomInBtn = magnifier.querySelector('.zoom-in');
      zoomOutBtn = magnifier.querySelector('.zoom-out');
      zoomLevelDisplay = magnifier.querySelector('.zoom-level');

      // Set up event listeners
      window.addEventListener('resize', syncContent, false);
      window.addEventListener('scroll', syncScrollBars, true);
      document.addEventListener('mousemove', trackMouse, false);

      // Initialize dragging and zoom
      makeDraggable(magnifier);
      setupZoomControls();
    }

    // Public methods
    _this.setZoom = function (value) {
      _this.options.zoom = value;
      setupMagnifier();
      updateMagnifiedArea();
      triggerEvent('zoomChanged', _this.options.zoom);
    };

    _this.setWidth = function (value) {
      _this.options.width = value;
      setupMagnifier();
    };

    _this.setHeight = function (value) {
      _this.options.height = value;
      setupMagnifier();
    };

    _this.setPosition = function (position) {
      _this.options.fixedPosition = Object.assign({}, _this.options.fixedPosition, position);
      setupMagnifier();
    };

    _this.setShowControls = function (show) {
      _this.options.showControls = show;
      if (magnifierControls) {
        magnifierControls.style.display = show ? 'flex' : 'none';
      }
    };

    _this.getZoom = function () { return _this.options.zoom; };
    // _this.getShape = function() { return _this.options.shape; };
    _this.getWidth = function () { return _this.options.width; };
    _this.getHeight = function () { return _this.options.height; };
    _this.isVisible = function () { return isVisible; };

    _this.on = function (event, callback) {
      events[event] = events[event] || [];
      events[event].push(callback);
    };

    _this.syncScrollBars = function () { syncScrollBars(); };
    _this.syncContent = function () { domChanged(); };

    _this.hide = function () {
      unBindDOMObserver();
      magnifierContent.innerHTML = '';
      magnifier.style.display = 'none';
      isVisible = false;
    };

    _this.show = function () {
      setupMagnifier();
      prepareContent();
      magnifier.style.display = '';
      updateMagnifiedArea();
      syncScrollBars();
      bindDOMObserver();
      isVisible = true;
    };

    // Initialize
    init();

    return _this;
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HTMLMagnifier;
  } else {
    window.HTMLMagnifier = HTMLMagnifier;
  }
})(window);