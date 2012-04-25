
var tty = require('tty');
var rl = require('readline');
var fs = require('fs');
var jv = exports, stack = [];

var stdin = process.openStdin(); 
tty.setRawMode(true);

var tabSize = 2;
var displayed = 0;
var copybuffer = 0;

var searchmode = false;
var searchbuffer = '';
var lastsearch = '';

var meta = [], map = [0];

var selection = 1;
var index = 0;

var write = function write (s) {
  process.stdout.write(s);
}

//
// used for cut/copy/paste
//
Object.defineProperties(Object, {
  'extend': {
    'configurable': true,
    'enumerable': false,
    'value': function extend(a, b) {

      var extObj, witKeys = Object.keys(b);
      extObj = Object.keys(a).length ? Object.clone(a) : {};

      witKeys.forEach(function (key) {
        Object.defineProperty(
          extObj, 
          key, 
          Object.getOwnPropertyDescriptor(b, key)
        );
      });

      return extObj;
    },
    'writable': true
  },
  'clone': {
    'configurable': true,
    'enumerable': false,
    'value': function clone(obj) {

      return Object.extend({}, obj);
    },
    'writable': true
  }
});

//
// move the cursor upward on the screen
//
var up = function up (i, save) {

  i = i || 1;

  if (i > 0) {
    while(i--) {
      write(!save ? '\033[K\033[1A\r' : '\033[1A\r');
    }
  }
};

var right = function right (i) {

  i = i || 1;

  if (i > 0) {
    while(i--) {
      write('\033[1C\r');
    }
  }
};

//
// generate whitespace
//
var ws = function ws (i, multiplier) {
  
  var s = '';
  
  if (multiplier) {
    i = i * tabSize;
  }

  while(i--) {
    s += ' ';
  }
  return s;
};

var getType = function getType (o) {

  if (typeof o === 'string' || typeof o === 'number' || 
    typeof o === 'boolean' || typeof o === 'function') {
    return typeof o;
  }
  else if (({}).toString.call(o) === '[object RegExp]') {
    return 'regexp';
  }
  else if (Array.isArray(o)) {
    return 'array';
  }
  else if (typeof o === 'undefined') {
    return 'undefined';
  }
  else if (({}).toString.call(o) === '[object Null]') {
    return 'null';
  }
  else if (({}).toString.call(o) === '[object Object]') {
    return 'object';
  }
};

//
// generate a representation of the data
//
var indent = 0;
var seed = -1;

var constructMeta = function constructMeta (parentType, depth, node, itemPrefix, dontPreface) {

  itemPrefix = itemPrefix || '';

  var first = meta.length === 0;
  var type = getType(node);
  seed++;

  function addStrData(node) {
    indent++;
    depth++;

    var buffer = '';
    var description = ws(indent, true);
    var maxWidth = process.stdout.getWindowSize()[0] - indent - 6;

    for (var i = 0, cpos = 0, l = node.length; i < l; i++, cpos++) {

      buffer += node[i];

      if (cpos >= maxWidth) {

        cpos = 0;

        meta.push({
          description: description + '\033[31m"' + buffer + '"\033[0m',
          expanded: false,
          displayed: first,
          type: type,
          depth: depth,
          index: seed++
        });

        buffer = '';
      }

    }

    if (buffer.length > 0) {

      meta.push({
        description: description + '\033[31m"' + buffer + '"\033[0m',
        expanded: false,
        displayed: first,
        type: type,
        depth: depth,
        index: seed++
      });

    }

    indent--;
  }

  switch(type) {
    case 'string':

      var extLen = (indent + itemPrefix.length) - 2;
      var truncatedNode = '0';
      var truncated = false;

        if (node.length > process.stdout.getWindowSize()[0] - extLen) {
          truncatedNode = '▸ ' + '\033[31m"' + node.substr(0, process.stdout.getWindowSize()[0]/2) + '..."\033[0m';
          truncated = true;
        }
        else {
          truncatedNode = '\033[31m"' + node + '"\033[0m';
        }

        meta.push({
          description: itemPrefix + truncatedNode,
          expanded: false,
          displayed: first,
          type: type,
          depth: depth,
          node: node,
          index: seed
        });

        if (truncated === true) {
          addStrData(node);
        }

    break;
    case 'number':
    case 'boolean':
    case 'undefined':
    case 'regexp':
    case 'null':

      meta.push({
        description: itemPrefix + '\033[31m' + node + '\033[0m',
        expanded: false,
        displayed: first,
        type: type,
        depth: depth,
        node: node,
        index: seed
      });

    break;
    case 'function':

      meta.push({
        description: itemPrefix + '▸ \033[36m[Function]\033[0m',
        expanded: false,
        displayed: first,
        type: type,
        depth: depth,
        node: node,
        index: seed
      });

      addStrData(node.toString());


    break;
    case 'array':

      meta.push({
        description: itemPrefix + '▸ \033[36mArray[\033[0m' + node.length + '\033[36m]\033[0m',
        expanded: false,
        displayed: first,
        type: type,
        depth: depth,
        node: node,
        index: seed
      });

      indent++;
      depth++;

      for (var i = 0, l = node.length; i < l; i++) {
        var description = ws(indent, true) + i + ': ';
        constructMeta(type, depth, node[i], description);
      }

      indent--;

    break;
    case 'object':

      meta.push({ 
        description: itemPrefix + '▸ \033[36mObject\033[0m',
        expanded: false,
        displayed: first,
        type: type,
        depth: depth,
        node: node,
        index: seed
      });

      indent++;
      depth++;

      for (var key in node) {
        var description = ws(indent, true) + key + ': ';
        constructMeta(type, depth, node[key], description);
      }

      indent--;

    break;
  }

};

var renderMeta = function renderMeta () {

  displayed = 0;

  for (var i = 0, l = meta.length; i < l; i++) {

    if (meta[i].displayed === true) {

      displayed++;

      if (displayed === selection) {
        write('\033[30;47m');
        write(meta[i].description.replace(/\033\[[0-9;]*m/g, '') + '\n');
        write('\033[0m');
      }
      else {
        write(meta[i].description + '\n');
      }

    }
  }
};

var toggle = function toggle (index) {

  var start = selection;
  var stop = meta.length;
  var next = meta[index].depth+1;
  var started = false;

  if (meta[index].type === 'string' && 
    (meta[index].description.indexOf('▸') === -1 && 
    meta[index].description.indexOf('▾') === -1)) {
    return;
  }

  if (meta[index].expanded) {

    meta[index].description = meta[index].description.replace('▾', '▸');
    meta[index].expanded = false;

    for (var i = index, l = stop; i < l; i++) {

      if (meta[i].depth >= next) {
        meta[i].displayed = false;

        //
        // if anything that was opened below this node shows that it was
        // expanded, change its icon so that it appears collapsed.
        //
        meta[i].description = meta[i].description.replace('▾', '▸');
        meta[i].expanded = false;
        started = true;
      }
      else if (started && meta[i].depth < next) {
        break;
      }
    }

  }
  else {

    meta[index].description = meta[index].description.replace('▸', '▾');
    meta[index].expanded = true;

    for (var i = index, l = stop; i < l; i++) {

      if (meta[i].depth === next) {
        meta[i].displayed = true;
        meta[i].expanded = false;
        started = true;
      }
      else if (started && meta[i].depth < next) {
        break;
      }
    }

  }

  map = [];
  for (var i = 0, l = meta.length; i < l; i++) {      
    if (meta[i].displayed === true) {
      map.push(meta[i].index);
    }
  }

  up(displayed);
  renderMeta();
}

var listener = function listener (chunk, key) {

  //
  // search mode stuff
  //
  if (chunk === '/') {

    searchmode = true;
    searchbuffer = '';

    //
    // show the user a prompt, if they did a search, 
    // include that before the prompt as the default.
    //
    if (lastsearch !== '') {
      process.stdout.write('(' + lastsearch + ') /');
    }
    else {
      process.stdout.write('/');
    }
  }
  else if (searchmode === true && typeof key !== 'undefined' && key.name === 'backspace') {
    
    //
    // dont delete more characters than the user has entered.
    //
    if (searchbuffer.length > 0) {

      searchbuffer = searchbuffer.slice(0, -1);
      write('\033[1D \033[1D');      
    }
  }
  else if (searchmode === true && typeof key !== 'undefined' && key.name === 'enter') {

    searchmode = false;

    //
    // if the user enters nothing, assume we want to repeat the last search.
    //
    if (searchbuffer === '') {

      searchbuffer = lastsearch;
    }
    else {

      //
      // start from the top if this is a unique search.
      //
      selection = 0;
    }

    //
    // clear the line
    //
    write('\r\033[K');

    var regexp;
    var found = false;

    //
    // create a regular expression from the input.
    // if its a bad regexp, let the user know nicely.
    //
    try {

      regexp = new RegExp(searchbuffer);
    }
    catch(e) {

      write(e.message + '\r');
      return;
    }

    for (var i = selection, l = meta.length; i < l; i++) {

      if (regexp.test(meta[i].description)) {

        //
        // we have a match now we need to unfold the appropriate nodes.
        //
        var currentDepth = meta[i].depth;
        var currentSelection = meta[i].index;
        var newSelection = 0;

        found = true;

        for (var j = i; j >= 0; j--) {

          if (meta[j].depth < currentDepth) {

            currentDepth--;
            if (meta[j].expanded === false) {
              toggle(j);
            }
          }
        }

        for (var i = 0, l = meta.length; i < l; i++) {

          if (meta[i].displayed === true) {
            newSelection++;
          }
          if (meta[i].index === currentSelection) {
            break;
          }
        }

        up(displayed);
        selection = newSelection;
        renderMeta();
        break;

      }
    }

    if (!found) {

      write('Not found\r');
    }

    //
    // save the last search even if its unsuccessful.
    //
    lastsearch = searchbuffer;

    //
    // reset the search buffer
    //
    searchbuffer = '';

    //
    // discontinue listening to keypresses until we're
    // done searching.
    //
    return true;
  }
  else if (searchmode === true) {
    
    write(chunk);
    searchbuffer += chunk;
  }

  //
  // exploration mode stuff
  //
  if (key && searchmode === false) {

    var downAction = (key.name === 'tab' && !key.shift) || key.name === 'down';
    var upAction = (key.shift && key.name === 'tab') || key.name === 'up';

    if (downAction && selection < displayed) {

      //
      // get the actual index of the item from the map.
      //
      index = map[selection];

      selection++;

      up(displayed);
      renderMeta();
    }

    if (upAction && selection > 1) {

      selection--;
      index = map[selection-1];

      up(displayed);
      renderMeta();
    }

    //
    // if this is a toggle, the value must be of type array or object.
    //
    if ((key.name === 'space' || key.name === 'enter' || 
          key.name === 'right' || key.name === 'left') &&
        (meta[index].type === 'array' || meta[index].type === 'object' ||
          meta[index].type === 'function' || meta[index].type === 'string')) {

      index = map[selection-1];
      toggle(index);
    }

    if (key.name === 'q' || key.ctrl && key.name === 'q') {
      stdin.removeListener('keypress', listener);
      stdin.pause();
    }

  }
};

var dir = function dir (obj, options) {

  constructMeta(getType(obj), 0, obj);
  renderMeta();

  stdin.on('keypress', listener);
};

module.exports = dir;
