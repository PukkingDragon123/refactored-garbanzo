#!/bin/sh
# 8-frame contact sheet of a reel: sheet.sh in.mp4 out.png
n=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 "$1")
step=$(( n / 8 ))
ffmpeg -loglevel error -y -i "$1" -vf "select='not(mod(n+$((step/2)),$step))',scale=270:-1:flags=neighbor,tile=8x1" -frames:v 1 -fps_mode vfr "$2"
