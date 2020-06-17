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

If you use this server, please reference the paper it was presented in:
```
@inproceedings{10.1145/3386290.3396932,
author = {Lyko, Tomasz and Broadbent, Matthew and Race, Nicholas and Nilsson, Mike and Farrow, Paul and Appleby, Steve},
title = {Evaluation of CMAF in Live Streaming Scenarios},
year = {2020},
isbn = {9781450379458},
publisher = {Association for Computing Machinery},
address = {New York, NY, USA},
url = {https://doi.org/10.1145/3386290.3396932},
doi = {10.1145/3386290.3396932},
booktitle = {Proceedings of the 30th ACM Workshop on Network and Operating Systems Support for Digital Audio and Video},
pages = {21–26},
numpages = {6},
keywords = {DASH, latency, ABR, video streaming, adaptive streaming, live, CMAF},
location = {Istanbul, Turkey},
series = {NOSSDAV ’20}
}
```
