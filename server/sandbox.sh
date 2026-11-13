#!/bin/sh
set -e
WS="$1"
NM="$2"
CMD="$3"
MEDIA="${4:--}"
ENGINES="${5:--}"
mount -t tmpfs -o size=16m none /mnt
mkdir -p /mnt/node_modules /mnt/work /mnt/media /mnt/engines
mount --bind "$NM" /mnt/node_modules
mount -o remount,bind,ro /mnt/node_modules 2>/dev/null || true
mount --bind "$WS" /mnt/work
if [ "$MEDIA" != "-" ] && [ -d "$MEDIA" ]; then mount --bind "$MEDIA" /mnt/media; mount -o remount,bind,ro /mnt/media 2>/dev/null || true; fi
if [ "$ENGINES" != "-" ] && [ -d "$ENGINES" ]; then mount --bind "$ENGINES" /mnt/engines; mount -o remount,bind,ro /mnt/engines 2>/dev/null || true; fi
mount -t tmpfs -o size=16m none /home
mount -t tmpfs -o size=16m none /root 2>/dev/null || true
if [ -d /srv ]; then mount -t tmpfs -o size=1m none /srv 2>/dev/null || true; fi
for d in /tmp /var/tmp; do mount -t tmpfs -o size=512m none "$d" 2>/dev/null || true; done
cd /mnt/work
[ -e node_modules ] || ln -s /mnt/node_modules node_modules
export HOME=/mnt/work NODE_PATH=/mnt/node_modules PATH=/mnt/engines/bin:/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 MPLCONFIGDIR=/tmp XDG_CACHE_HOME=/tmp
unset AUTEUR_DATA AUTEUR_INTERNAL_URL
LIMIT="${SANDBOX_SECONDS:-30}"
exec timeout -k 2 "$LIMIT" prlimit --cpu="$LIMIT" --as=4294967296 --nproc=256 --fsize=1073741824 sh -c "$CMD"
