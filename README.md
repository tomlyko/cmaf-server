# cmaf-server
Simple Node.JS server capable of serving CMAF chunks using HTTP/1.1 Chunked Transfer

The server delivers pre-encoded content as if it was live by constructing an accurate timeline of segment and chunk availability times at server side.

Chunks can be served from memory allowing for low latency streaming with small chunks.

The server takes one parameter:
  - StreamStartTime - timestamp (as unix time) of the start of the stream, based on which the segment and chunk availability times are calculated,

To run:
```
nodejs CMAF-server.js <StreamStartTime>
```

If you use this server, please reference this repository.
