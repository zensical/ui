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

import {
  Observable,
  Subject,
  animationFrameScheduler,
  auditTime,
  combineLatest,
  debounceTime,
  defer,
  endWith,
  filter,
  finalize,
  fromEvent,
  ignoreElements,
  map,
  merge,
  switchMap,
  take,
  takeUntil,
  tap,
  throttleTime,
  withLatestFrom
} from "rxjs"

import {
  ElementOffset,
  getActiveElement,
  getElementSize,
  getElements,
  watchElementContentOffset,
  watchElementFocus,
  watchElementOffset,
  watchElementVisibility
} from "~/browser"

import { Component } from "../../../_"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Annotation
 */
export interface Annotation {
  active: boolean                      // Annotation is active
  offset: ElementOffset                // Annotation offset
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Watch annotation
 *
 * @param el - Annotation element
 * @param container - Containing element
 *
 * @returns Annotation observable
 */
export function watchAnnotation(
  el: HTMLElement, container: HTMLElement
): Observable<Annotation> {
  const offset$ = defer(() => combineLatest([
    watchElementOffset(el),
    watchElementContentOffset(container)
  ]))
    .pipe(
      map(([{ x, y }, scroll]): ElementOffset => {
        const { width, height } = getElementSize(el)
        return ({
          x: x - scroll.x + width  / 2,
          y: y - scroll.y + height / 2
        })
      })
    )

  // Actively watch annotation on focus
  return watchElementFocus(el)
    .pipe(
      switchMap(active => offset$
        .pipe(
          map(offset => ({ active, offset })),
          take(+!active || Infinity)
        )
      )
    )
}

/**
 * Mount annotation
 *
 * @param el - Annotation element
 * @param container - Containing element
 *
 * @returns Annotation component observable
 */
export function mountAnnotation(
  el: HTMLElement, container: HTMLElement
): Observable<Component<Annotation>> {
  const [tooltip, index] = Array.from(el.children)

  // Inactive tooltips are detached to prevent their content from introducing
  // empty lines when copied. Preserve all IDs in their place, since location
  // targets can only be resolved while an element with the requested ID is in
  // the document. Descendant IDs are included so any exact anchor inside an
  // annotation remains addressable, not just the tooltip's own anchor.
  const targets = tooltip instanceof HTMLElement
    ? [tooltip, ...getElements<HTMLElement>("[id]", tooltip)]
        .filter(target => target.id)
    : []

  // Hidden placeholders participate in target resolution without affecting
  // layout, rendering, focus order, or copied annotation content.
  const placeholders = targets.map(target => {
    const placeholder = document.createElement("span")
    placeholder.id = target.id
    placeholder.hidden = true
    return placeholder
  })

  // Mount component on subscription
  return defer(() => {
    const push$ = new Subject<Annotation>()
    const done$ = push$.pipe(ignoreElements(), endWith(true))
    push$.subscribe({

      // Handle emission
      next({ offset }) {
        el.style.setProperty("--md-tooltip-x", `${offset.x}px`)
        el.style.setProperty("--md-tooltip-y", `${offset.y}px`)
      },

      // Handle complete
      complete() {
        el.style.removeProperty("--md-tooltip-x")
        el.style.removeProperty("--md-tooltip-y")
      }
    })

    // Start animation only when annotation is visible
    watchElementVisibility(el)
      .pipe(
        takeUntil(done$)
      )
        .subscribe(visible => {
          el.toggleAttribute("data-md-visible", visible)
        })

    // Toggle tooltip presence to mitigate empty lines when copying
    merge(
      push$.pipe(filter(({ active }) => active)),
      push$.pipe(debounceTime(250), filter(({ active }) => !active))
    )
      .subscribe({

        // Handle emission
        next({ active }) {
          if (active) {

            // Replace one placeholder atomically with the tooltip, ensuring
            // its IDs remain resolvable throughout the transition. The target
            // component re-resolves the requested ID after this replacement
            // so it can reveal and scroll to the real element.
            const placeholder = placeholders.find(child => child.parentNode)
            if (placeholder) {
              placeholder.replaceWith(tooltip)
              for (const child of placeholders)
                child.remove()

            // A tooltip without IDs has no placeholders and is restored using
            // the original behavior when its annotation becomes active.
            } else if (!tooltip.parentNode) {
              el.prepend(tooltip)
            }

          // Keep exact anchors addressable while removing tooltip content from
          // layout and the document's copied text when the annotation closes.
          } else if (placeholders.length) {
            tooltip.replaceWith(...placeholders)

          // Preserve the original detach behavior when there are no IDs.
          } else {
            tooltip.remove()
          }
        },

        // Handle complete
        complete() {

          // Restore the authored DOM when the component is unmounted and
          // discard every synthetic placeholder it introduced.
          for (const placeholder of placeholders)
            placeholder.remove()
          if (!tooltip.parentNode)
            el.prepend(tooltip)
        }
      })

    // Toggle tooltip visibility
    push$
      .pipe(
        auditTime(16, animationFrameScheduler)
      )
        .subscribe(({ active }) => {
          tooltip.classList.toggle("md-tooltip--active", active)
        })

    // Track relative origin of tooltip
    push$
      .pipe(
        throttleTime(125, animationFrameScheduler),
        filter(() => !!el.offsetParent),
        map(() => el.offsetParent!.getBoundingClientRect()),
        map(({ x }) => x)
      )
        .subscribe({

          // Handle emission
          next(origin) {
            if (origin)
              el.style.setProperty("--md-tooltip-0", `${-origin}px`)
            else
              el.style.removeProperty("--md-tooltip-0")
          },

          // Handle complete
          complete() {
            el.style.removeProperty("--md-tooltip-0")
          }
        })

    // Allow to copy link without scrolling to anchor
    fromEvent<MouseEvent>(index, "click")
      .pipe(
        takeUntil(done$),
        filter(ev => !(ev.metaKey || ev.ctrlKey))
      )
        .subscribe(ev => {
          ev.stopPropagation()
          ev.preventDefault()
        })

    // Allow to open link in new tab or blur on close
    fromEvent<MouseEvent>(index, "mousedown")
      .pipe(
        takeUntil(done$),
        withLatestFrom(push$)
      )
        .subscribe(([ev, { active }]) => {

          // Open in new tab
          if (ev.button !== 0 || ev.metaKey || ev.ctrlKey) {
            ev.preventDefault()

          // Close annotation
          } else if (active) {
            ev.preventDefault()

            // Focus parent annotation, if any
            const parent = el.parentElement!.closest(".md-annotation")
            if (parent instanceof HTMLElement)
              parent.focus()
            else
              getActiveElement()?.blur()
          }
        })

    // Create and return component
    return watchAnnotation(el, container)
      .pipe(
        tap(state => push$.next(state)),
        finalize(() => push$.complete()),
        map(state => ({ ref: el, ...state }))
      )
  })
}
