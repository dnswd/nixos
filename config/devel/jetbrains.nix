{ pkgs, ... }:
{
  home.packages = [
    pkgs.jetbrains.idea-oss
  ];

  home.file.".ideavimrc".source =
    pkgs.writeText "ideavimrc" # vim
      ''
        """ Settings (matching Neovim general.nix)
        set clipboard+=unnamed
        set clipboard+=ideaput
        set number
        set relativenumber
        set ignorecase
        set smartcase
        set incsearch
        set hlsearch
        set scrolloff=8
        set sidescrolloff=8

        """ IdeaVim specific
        set ideajoin
        set idearefactormode=keep

        let mapleader=" "

        """ Config reload
        nnoremap <leader>e :e ~/.ideavimrc<CR>
        nnoremap <leader>R :action IdeaVim.ReloadVimRc.reload<CR>

        """ Window splits (matching Neovim splitright/splitbelow)
        nnoremap <c-\> :action SplitVertically<CR>
        nnoremap <c--> :action SplitHorizontally<CR>
        nnoremap <c-=> :action Unsplit<CR>
        nnoremap <c-m> :action MoveEditorToOppositeTabGroup<CR>

        """ Window navigation (matching Neovim <c-h/j/k/l>)
        sethandler <c-j> a:vim
        sethandler <c-k> a:vim
        sethandler <c-h> a:vim
        sethandler <c-l> a:vim
        nnoremap <c-h> <c-w>h
        nnoremap <c-l> <c-w>l
        nnoremap <c-j> <c-w>j
        nnoremap <c-k> <c-w>k

        """ Tab/Buffer navigation (matching <leader><leader> for buffers)
        nnoremap <TAB> :action NextTab<CR>
        nnoremap <s-TAB> :action PreviousTab<CR>
        nnoremap <leader><leader> :action Switcher<CR>
        nnoremap <leader>q :action CloseContent<CR>

        """ Search - Telescope equivalents
        nnoremap <leader>sf :action GotoFile<CR>
        nnoremap <leader>sg :action FindInPath<CR>
        nnoremap <leader>sw :action FindWordAtCaret<CR>
        nnoremap <leader>sh :action HelpTopics<CR>
        nnoremap <leader>sk :action GotoAction<CR>
        nnoremap <leader>sd :action ActivateProblemsViewToolWindow<CR>
        nnoremap <leader>sr :action RecentFiles<CR>
        nnoremap <leader>s. :action RecentFiles<CR>
        nnoremap <leader>ss :action GotoSymbol<CR>
        nnoremap <leader>/ :action Find<CR>

        """ LSP - matching lsp.nix keymaps
        nnoremap grr :action FindUsages<CR>
        nnoremap gri :action GotoImplementation<CR>
        nnoremap grd :action GotoDeclaration<CR>
        nnoremap grt :action GotoTypeDeclaration<CR>
        nnoremap grn :action RenameElement<CR>
        nnoremap gra :action ShowIntentionActions<CR>
        vnoremap gra :action ShowIntentionActions<CR>
        nnoremap grD :action GotoDeclaration<CR>
        nnoremap gO :action FileStructurePopup<CR>
        nnoremap gW :action GotoSymbol<CR>

        """ Diagnostics (matching <leader>q for quickfix)
        nnoremap <leader>Q :action ActivateProblemsViewToolWindow<CR>
        nnoremap ]d :action GotoNextError<CR>
        nnoremap [d :action GotoPreviousError<CR>

        """ Format (matching conform.nix <leader>f)
        nnoremap <leader>f :action ReformatCode<CR>
        vnoremap <leader>f :action ReformatCode<CR>

        """ Debug - matching dap.nix keymaps
        nnoremap <F5> :action Debug<CR>
        nnoremap <F1> :action StepInto<CR>
        nnoremap <F2> :action StepOver<CR>
        nnoremap <F3> :action StepOut<CR>
        nnoremap <leader>b :action ToggleLineBreakpoint<CR>
        nnoremap <leader>B :action AddConditionalBreakpoint<CR>
        nnoremap <F7> :action ActivateDebugToolWindow<CR>

        """ Git - matching gitsigns.nix keymaps
        nnoremap ]c :action VcsShowNextChangeMarker<CR>
        nnoremap [c :action VcsShowPrevChangeMarker<CR>
        nnoremap <leader>hs :action Vcs.RollbackChangedLines<CR>
        nnoremap <leader>hr :action Vcs.RollbackChangedLines<CR>
        nnoremap <leader>hp :action VcsShowCurrentChangeMarker<CR>
        nnoremap <leader>hb :action Annotate<CR>
        nnoremap <leader>hd :action Compare.SameVersion<CR>
        nnoremap <leader>hD :action Compare.LastVersion<CR>
        nnoremap <leader>tb :action Annotate<CR>

        """ File explorer (matching oil.nix - key)
        nnoremap - :action SelectInProjectView<CR>

        """ Toggle inlay hints (matching <leader>th)
        nnoremap <leader>th :action ToggleInlayHintsGloballyAction<CR>

        """ Folding
        nnoremap zc :action CollapseRegion<CR>
        nnoremap zo :action ExpandRegion<CR>
        nnoremap zM :action CollapseAllRegions<CR>
        nnoremap zR :action ExpandAllRegions<CR>

        """ Method navigation
        nnoremap [[ :action MethodUp<CR>
        nnoremap ]] :action MethodDown<CR>

        """ Visual mode indentation (keep selection)
        vnoremap < <gv
        vnoremap > >gv

        """ Surround support (matching mini.surround)
        set surround

        """ Commentary (gc)
        set commentary

        """ Text objects (matching mini.ai)
        set argtextobj
        set textobj-entire

        """ Zen mode
        nnoremap <c-z> :action ToggleDistractionFreeMode<CR>

        """ Terminal
        nnoremap <c-t> :action ActivateTerminalToolWindow<CR>

        """ Run actions
        nnoremap ,r :action ContextRun<CR>
        nnoremap ,d :action ContextDebug<CR>
        nnoremap ,c :action ChooseRunConfiguration<CR>
        nnoremap ,u :action Rerun<CR>
        nnoremap ,t :action ActivateRunToolWindow<CR>
      '';
}
