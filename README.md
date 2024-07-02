# Medialon

A collection of scripts and tools for the Medialon show control platform.

On the web: <https://medialon.com>

## Things to note
Whilst Medialon uses a JavaScript interpreter for its MxM Script, the available functions are pretty limited, sticking to anything from ES5 is a fairly safe bet. Using the Math object is totally out! Additionally it's not possible to include any dependancies, for example to process incoming OSC/TCP packets, so any data processing needs to occur at a reasonably low level within the script.
