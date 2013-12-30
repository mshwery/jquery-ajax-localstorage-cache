(function() {

  function hasLocalStorage() {
    return window.localStorage && typeof localStorage !== "undefined";
  }

  // hash to store current requests
  var requests = {
    active: {},
    add: function(url, jqXHR) {
      this.active[ url ] = jqXHR;
    },
    remove: function(url) {
      delete this.active[ url ];
    }
  };

  $.ajaxPrefilter(function( options, originalOptions, jqXHR ) {


    if ( options.preventDuplicates ) {
      // Duplicate request? Abort!
      if ( requests.active[ options.url ] ) {
        jqXHR.abort();
      } else {
        // add new request to hash
        requests.add( options.url, jqXHR );
      }

      // Remove completed requests from our hash
      if ( options.complete ) {
        options.realcomplete = options.complete;
      }
      options.complete = function( data, status ) {
        requests.remove( options.url );
        // call the original complete callback
        if ( options.realcomplete ) options.realcomplete( data, status );
      };
    }

    // No connection?
    // Get it from cache
    // what should happen if ttl has expired and it gets removed from cache?
    // isn't old cache better than no data?

    /*
     * Most of the following comes from Paul Irish's localStorage implementation
     * with some slight alterations
     * https://github.com/paulirish/jquery-ajax-localstorage-cache
     */

    // Cache the response?
    if ( !hasLocalStorage() || !options.localCache ) return;

    var jsonString = options.data;
    // if it's not already stringified, stringify
    try {
      JSON.parse(options.data);
    } catch(err) {
      jsonString = JSON.stringify(options.data);
    }

    var hourstl = options.cacheTTL || 5;

    var cacheKey = options.cacheKey || options.url.replace( /jQuery.*/,'' ) + options.type + jsonString;

    // isCacheValid is a function to validate cache
    if ( options.isCacheValid &&  ! options.isCacheValid() ){
      localStorage.removeItem( cacheKey );
    }
    // if there's a TTL that's expired, flush this item
    var ttl = localStorage.getItem(cacheKey + 'cachettl');
    if ( ttl && ttl < +new Date() ){
      localStorage.removeItem( cacheKey );
      localStorage.removeItem( cacheKey  + 'cachettl' );
      ttl = 'expired';
    }

    var value = localStorage.getItem( cacheKey );
    if ( value ){
      //In the cache? So get it, apply success callback & abort the XHR request
      // parse back to JSON if we can.
      if ( options.dataType.indexOf( 'json' ) === 0 ) value = JSON.parse( value );
      if ( options.success ) options.success( value );
      console.log('cache found');
      console.log(value);
      // Abort is broken on JQ 1.5 :(
      jqXHR.abort();
    } else {

      console.log('not in cache, attempting jqXHR...');
      //If it not in the cache, we change the success callback, just put data on localstorage and after that apply the initial callback
      if ( options.success ) {
        options.realsuccess = options.success;
      }
      options.success = function( data ) {
        var strdata = data;
        if ( this.dataType.indexOf( 'json' ) === 0 ) strdata = JSON.stringify( data );

        // Save the data to localStorage catching exceptions (possibly QUOTA_EXCEEDED_ERR)
        try {
          localStorage.setItem( cacheKey, strdata );
        } catch (e) {
          // Remove any incomplete data that may have been saved before the exception was caught
          localStorage.removeItem( cacheKey );
          localStorage.removeItem( cacheKey + 'cachettl' );
          if ( options.cacheError ) options.cacheError( e, cacheKey, strdata );
        }

        if ( options.realsuccess ) options.realsuccess( data );
      };

      // store timestamp
      if ( ! ttl || ttl === 'expired' ) {
        localStorage.setItem( cacheKey  + 'cachettl', +new Date() + 1000 * 60 * 60 * hourstl );
      }
      
    }
  });

})();