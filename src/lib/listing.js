// The regulation list, shown a page at a time (K-074). With about 2,600 cards, a page that lays out
// every card makes a phone recompute styles for all of them on every change, which is where most
// of the load time went. The first PAGE cards are in the HTML; the rest wait in a <template>, parsed
// but not rendered, and are moved into the list as the reader asks for more. Ordering and filters
// work on all cards, not only on the ones shown.

export const PAGE = 100;

/**
 * list: the <ol>; rest: the <template> holding the other cards; more: the "show more" button;
 * count: an element that says how many are shown. Returns { sort, filter, all, visibleCount }.
 */
export function createListing({ list, rest, more, count }) {
  const all = [...list.children, ...(rest ? [...rest.content.children] : [])];
  let order = all;
  let pass = () => true;
  let visible = all;
  let shown = 0;

  // A page boundary never separates two records of one regulation, which always stand together.
  function cut(limit) {
    let end = Math.min(limit, visible.length);
    while (end > 0 && end < visible.length && visible[end].dataset.group === visible[end - 1].dataset.group) end++;
    return end;
  }

  function render(limit) {
    shown = cut(limit);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < shown; i++) fragment.appendChild(visible[i]);
    list.replaceChildren(fragment);
    const left = visible.length - shown;
    more.hidden = left <= 0;
    more.textContent = `Tampilkan ${Math.min(PAGE, left).toLocaleString("id-ID")} lagi`;
    count.textContent = `Menampilkan ${shown.toLocaleString("id-ID")} dari ${visible.length.toLocaleString("id-ID")} dokumen.`;
  }

  more.addEventListener("click", () => {
    const first = shown;
    render(shown + PAGE);
    // Keep the reader's place: move focus to the first newly shown card's link.
    const link = visible[first] && visible[first].querySelector("a");
    if (link) link.focus({ preventScroll: false });
  });

  render(PAGE);

  return {
    all,
    /** New order for every card; the list starts again at the first page. */
    sort(compare) {
      order = all.slice().sort(compare);
      visible = order.filter(pass);
      render(PAGE);
    },
    /** Show only cards for which `test(card)` is true; returns how many there are. */
    filter(test) {
      pass = test;
      visible = order.filter(pass);
      render(PAGE);
      return visible.length;
    },
  };
}
