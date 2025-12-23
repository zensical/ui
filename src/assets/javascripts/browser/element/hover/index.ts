/*
 * Copyright (c) 2025 Zensical and contributors
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

import {
  Observable,
  debounce,
  defer,
  fromEvent,
  identity,
  map,
  merge,
  startWith,
  timer
} from "rxjs"

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Watch element hover
 *
 * The second parameter allows to specify a timeout in milliseconds after which
 * the hover state will be reset to `false`. This is useful for tooltips which
 * should disappear after a certain amount of time, in order to allow the user
 * to move the cursor from the host to the tooltip.
 *
 * @param el - Element
 * @param timeout - Timeout
 *
 * @returns Element hover observable
 */
export function watchElementHover(
  el: HTMLElement, timeout?: number
): Observable<boolean> {
  const { matches: hover } = matchMedia("(hover)")
  return defer(() => {
    const events = hover
      ? merge(
          fromEvent(el, "mouseenter").pipe(map(() => true)),
          fromEvent(el, "mouseleave").pipe(map(() => false))
        )
      : merge (
          fromEvent(el, "touchstart").pipe(map(() => true)),
          fromEvent(el, "touchend").pipe(map(() => false)),
          fromEvent(el, "touchcancel").pipe(map(() => false)),
        )

    // Apply debounce if timeout is specified - we emit two times, to make sure
    // that tooltips are synchronized. We'll refactor this in the future, but
    // will move to an entirely new event system anyway, as we move on to a
    // proper component system implementation.
    return events.pipe(
      timeout ? debounce(active => timer(+!active * timeout)) : identity,
      startWith(true, el.matches(":hover"))
    )
  })
}
