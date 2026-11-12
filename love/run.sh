#!/bin/sh
# Start the LÖVE version, fetching the shared word lists on first run.
cd "$(dirname "$0")" || exit 1
[ -f words.txt ] || cp ../data/words.txt .
[ -f common.txt ] || cp ../data/common.txt .
exec love .
