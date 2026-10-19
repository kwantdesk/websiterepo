// Embedded tools cannot render the React shell. Keep this presentation aligned
// with KwantLoader (compact), using the same theme, emblem and motion contract.
export function showWorkspaceLoading(target,title='Loading workspace'){
  if(target.dataset.loadingTitle===title&&target.firstElementChild?.classList.contains('site-workspace-loader'))return;
  target.dataset.loadingTitle=title;
  const loader=document.createElement('div');loader.className='site-workspace-loader';
  loader.setAttribute('role','status');loader.setAttribute('aria-live','polite');loader.setAttribute('aria-busy','true');
  loader.innerHTML='<span class="site-loader-backdrop" aria-hidden="true"></span><div class="site-loader-content"><span class="site-loader-emblem" aria-hidden="true"><span class="site-loader-halo"></span><span class="site-loader-orbit"></span><svg class="site-loader-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z"/><path d="M5 3v4M3 5h4m12 12v4m-2-2h4"/></svg></span><div class="site-loader-title"></div></div>';
  loader.querySelector('.site-loader-title').textContent=title;
  target.replaceChildren(loader);
}
