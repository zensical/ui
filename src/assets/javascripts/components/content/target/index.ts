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
  EMPTY,
  Observable,
  animationFrames,
  defer,
  filter,
  map,
  switchMap,
  take,
  takeWhile,
  tap
} from "rxjs"

import { feature } from "~/_"
import { ViewportOffset, getElements } from "~/browser"

import { Component } from "../../_"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Content target
 */
export interface ContentTarget {
  id: string                          // Content target identifier
}

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Mount options
 */
interface MountOptions {
  target$: Observable<HTMLElement>     // Location target observable
}

/* ----------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Reveal content target
 *
 * @param el - Content element
 * @param target - Content target
 */
function reveal(el: HTMLElement, target: HTMLElement): void {

  // Open enclosing details
  for (const details of getElements<HTMLDetailsElement>("details", el))
    if (!details.open && details.contains(target))
      details.open = true

  // Switch enclosing content tabs
  for (const tabs of getElements<HTMLElement>("[data-tabs]", el)) {
    const inputs = getElements<HTMLInputElement>(":scope > input", tabs)
    let index = inputs.indexOf(target as HTMLInputElement)

    // Find content tab containing target
    if (index === -1) {
      const blocks = getElements<HTMLElement>(
        ":scope > .tabbed-content > .tabbed-block", tabs
      )
      index = blocks.findIndex(block => block.contains(target))
    }

    // Switch to content tab
    const input = inputs[index]
    if (input && !input.checked)
      input.click()
  }

  // Open enclosing annotations
  for (const annotation of getElements<HTMLElement>(".md-annotation", el))
    if (annotation.contains(target))
      annotation.focus()
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Mount content target
 *
 * This function reveals location targets inside components that hide content.
 * Targets are resolved repeatedly, since opening one component can expose a
 * deeper target on the next animation frame. Target handling is intentionally
 * centralized here: details, content tabs, and annotations keep ownership of
 * their regular interaction state, but don't subscribe to location targets.
 *
 * @param el - Content element
 * @param options - Options
 *
 * @returns Content target component observable
 */
export function mountContentTarget(
  el: HTMLElement, { target$ }: MountOptions
): Observable<Component<ContentTarget>> {
  const initial = window.location.href
  return target$.pipe(
    switchMap((target, index) => defer(() => {
      const id = target.id
      const current = document.getElementById(id) || target
      if (!el.contains(current))
        return EMPTY

      const href = window.location.href

      // Capture saved positions before revealing content can change the viewport
      const offset: ViewportOffset | null = feature("navigation.instant")
        ? history.state
        : null

      // Preserve native full-page restoration after revealing hidden targets.
      // WebKit favors fragments instead, so retain explicit alignment there.
      // Later anchor clicks also need alignment after revealing their target.
      const navigation = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined
      const restoring = index === 0 && href === initial &&
        !feature("navigation.instant") &&
        navigator.vendor !== "Apple Computer, Inc." &&
        document.readyState !== "complete" && (
          navigation?.type === "reload" ||
          navigation?.type === "back_forward"
        )

      // Reveal the target immediately so synchronous containers, such as
      // details and content tabs, don't need to wait for a rendering cycle.
      // An annotation is different: its tooltip is detached while inactive
      // and represented by hidden ID placeholders. Focusing the annotation
      // restores the tooltip through its component stream, so the placeholder
      // that produced the target emission isn't necessarily the element that
      // must ultimately be scrolled into view. Layout also needs a rendering
      // cycle before getClientRects() can confirm that the replacement target
      // is visible.
      //
      // A single observeOn(animationFrameScheduler) would only postpone this
      // work once. It wouldn't cover multiple nested replacement and reveal
      // stages. animationFrames() provides one retry per rendered frame and is
      // automatically cancelled when switchMap sees a newer target or the
      // content component is unmounted.
      reveal(el, current)
      return animationFrames().pipe(

        // Keep retries finite if custom styles or markup never reveal target
        take(11),

        // Resolve by ID on every frame, since an annotation can replace the
        // original placeholder with the actual target between emissions
        map((_, frame) => ({
          target: document.getElementById(id) || current,
          frame
        })),

        // Stop if another navigation changed the location or containing content
        takeWhile(state => (
          el.contains(state.target) && window.location.href === href
        )),

        // Each replacement can expose another enclosing component to reveal
        tap(state => reveal(el, state.target)),

        // Wait until layout confirms visibility, but guarantee termination
        // after ten retries so a permanently hidden target can't leak work
        filter(state => (
          state.target.getClientRects().length > 0 || state.frame === 10
        )),
        take(1),

        // Restore history positions after all containers are open; fresh
        // fragment navigation still aligns the target with the viewport
        tap(state => {
          if (typeof offset?.y === "number")
            window.scrollTo(offset.x, offset.y)
          else if (!restoring)
            state.target.scrollIntoView()
        }),
        map(state => ({ ref: state.target, id }))
      )
    }))
  )
}
