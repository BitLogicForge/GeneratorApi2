#!/usr/bin/env bash
set -eo pipefail

id="$1"
title="$2"
shift 2

echo -e "\e[0Ksection_start:$(date +%s):${id}[collapsed=true]\r\e[0K\e[36;1m${title}\e[0m"
trap 'echo -e "\e[0Ksection_end:$(date +%s):${id}\r\e[0K"' EXIT
"$@"
