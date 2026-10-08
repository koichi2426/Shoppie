#!/bin/sh
# Keep the Homebrew Python/XML compatibility workaround scoped to AWS CLI.
# Python 3.14.8 can reference symbols missing from macOS's system libexpat.
set -eu
if [ "$(uname -s)" = Darwin ] && [ -f /opt/homebrew/opt/expat/lib/libexpat.1.dylib ]; then
    export DYLD_LIBRARY_PATH="/opt/homebrew/opt/expat/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
fi
exec aws "$@"
