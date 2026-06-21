/*
 * Copyright (c) 2025-2026 Zensical and contributors
 *
 * SPDX-License-Identifier: MIT
 * Third-party contributions licensed under DCO
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Search configuration
 */
export interface SearchConfig {
  separator: string                    // Search separator
}

/**
 * Search item
 */
export interface SearchItem {
  location: string                     // Item location
  title: string                        // Item title
  text: string                         // Item text
  path?: string[]                      // Item path
  tags?: string[]                      // Item tags
}

// -------------------------------------------------------------------------

/**
 * Search index
 */
export interface SearchIndex {
  config: SearchConfig                 // Search configuration
  items: SearchItem[]                  // Search items
}
