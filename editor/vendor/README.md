# HEIC conversion dependency

This editor lazily loads the unmodified IIFE build of heic-to 1.6.5 to convert HEIC/HEIF photos to JPEG locally in the browser.

Upstream source and build instructions: https://github.com/hoppergee/heic-to/tree/main
Pinned distribution: https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/iife/heic-to.js

heic-to and its libheif decoder are distributed under LGPL-3.0-or-later. See HEIC-LICENSE.txt and GPL-3.0.txt. The converter is kept separate from the editor and can be replaced with a compatible build.

