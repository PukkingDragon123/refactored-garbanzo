#!/bin/sh
# N-frame contact sheet of a reel (default 8, evenly spaced): sheet.sh in.mp4 out.png [N]
N=${3:-8}
n=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 "$1")
step=$(( n / N ))
ffmpeg -loglevel error -y -i "$1" -vf "select='not(mod(n+$((step/2)),$step))',scale=180:-1:flags=neighbor,tile=${N}x1" -frames:v 1 -fps_mode vfr "$2"
