#!/bin/sh
set -e

id="$1"
title="$2"
shift 2

printf '\033[0Ksection_start:%s:%s[collapsed=true]\r\033[0K\033[36;1m%s\033[0m\n' "$(date +%s)" "$id" "$title"
trap 'printf "\033[0Ksection_end:%s:%s\r\033[0K\n" "$(date +%s)" "$id"' EXIT
"$@"
