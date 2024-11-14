# Keymaps reference

I'm still trying to find better flow, and I keep editing my keymaps. This is file serve as
quick reference just in case I forget something.

### Kitty

| Description          | Key                              |
| -------------------- | -------------------------------- |
| Paste from clipboard | `ctrl+shift+v`                   |
| Toggle fullscreen    | `ctrl+shift+f`                   |
| Open URL with hints  | `ctrl+shift+e`                   |
| Increase font size   | `ctrl+shift+=` or `ctrl+shift++` |
| Decrease font size   | `ctrl+shift+-`                   |
| Reset font size      | `ctrl+shift+backspace`           |


### Tmux

| Description                           | Mode | Key                        |
| ------------------------------------- | ---- | -------------------------- |
| Prefix                                | n    | `ctrl+space`               |
| Enter copy mode                       | n    | `prefix+c`                 |
| Begin selection (copy mode)           | c    | `v`                        |
| Begin rectangle selection (copy mode) | c    | `ctrl+v`                   |
| Yank selection (copy mode)            | c    | `y`                        |
| List sessions                         | n    | `prefix+l`                 |
| New window (tab)                      | n    | `alt+shift+t`              |
| Close window (tab)                    | n    | `alt+shift+w`              |
| Switch next window (tab)              | n    | `alt+shift+h`              |
| Switch previous window (tab)          | n    | `alt+shift+l`              |
| Split pane vertically                 | n    | `alt+\|`                   |
| Split pane horizontally               | n    | `alt+-`                    |
| Close pane                            | n    | `alt+shift+p`              |
| Toggle full window pane               | n    | `alt+z`                    |
| Select pane to the left               | n    | `alt+h`                    |
| Select pane to the right              | n    | `alt+l`                    |
| Select pane to the up                 | n    | `alt+k`                    |
| Select pane to the down               | n    | `alt+j`                    |
| Switch n-th window                    | n    | `alt+${n}` for 1 <= n <= 9 |

TODO: tmux-sessionizer keymap?

### Neovim

| Description                               | Mode | Key              | Alternate    |
| ----------------------------------------- | ---- | ---------------- | ------------ |
| Leader                                    | x    | `space`          |              |
| \*Toggle nvim-tree (file tree)            | n    | `leader+v`       |              |
| Toggle UndoTree                           | n    | `leader+u`       | `leader+b+u` |
| Make current file executable              | n    | `leader+x`       | `leader+b+x` |
| Open lazygit                              | n    | `leader+g+g`     | `leader+p+g` |
| New tmux session via tmux-sessionizer     | n    | `ctrl+f`         | `leader+p+o` |
| Toggle codeium chat                       | n    | `leader+shift+c` | `leader+p+c` |
| Find files in project                     | n    | `leader+p+f`     |              |
| Find git files in project                 | n    | `leader+p+g`     |              |
| Find string in project (grep)             | n    | `leader+p+s`     |              |
| Add file to harpoon                       | n    | `leader+q+a`     |              |
| Toggle harpoon menu                       | n    | `leader+q+q`     |              |
| Switch harpoon registry 1                 | n    | `ctrl+j`         |              |
| **Switch harpoon registry 2**             | n    | `ctrl+k`         |              |
| Switch harpoon registry 3                 | n    | `ctrl+l`         |              |
| Switch harpoon registry 4                 | n    | `ctrl+;`         |              |
| Page up but keep cursor in the middle     | n    | `ctrl+u`         |              |
| Page down but keep cursor in the middle   | n    | `ctrl+d`         |              |
| Next search but keep cursor in the middle | n    | `n`              |              |
| Prev search but keep cursor in the middle | n    | `shift+n`        |              |
| Next error                                | n    | `leader+k`       |              |
| Prev error                                | n    | `leader+j`       |              |
| **Next error in quickfix**                | n    | `ctrl+k`         | `leader+q+k` |
| Prev error in quickfix                    | n    | `ctrl+j`         | `leader+q+j` |
| Move highlighted lines upwards            | v    | `shift+j`        |              |
| Move highlighted lines downwards          | v    | `shift+k`        |              |
| Paste wihout replacing register content   | n    | `leader+p`       |              |
| Delete to void                            | n+v  | `leader+d`       |              |
| Yank to system register                   | n+v  | `leader+y`       |              |
| Yank to system register                   | n    | `leader+shift+y` |              |
| \*Preprend cursor line with line below    | n    | `shift+j`        |              |
| Substitute word under cursor              | n    | `leader+s`       |              |

\*) Special case

### CMP

| Description                                          | Mode | Key         |
| ---------------------------------------------------- | ---- | ----------- |
| Scroll completion docs up                            | n    | `ctrl+f`    |
| Scroll completion docs down                          | n    | `ctrl+d`    |
| Scroll completion                                    | n    | `ctrl+i`    |
| Dismiss completion                                   | n    | `ctrl+e`    |
| Select completion                                    | n    | `enter`     |
| Scroll completion down or jump next snippet region   | n    | `tab`       |
| Scroll completion up or jump previous snippet region | n    | `shift+tab` |

### LSP

| Description     | Mode | Key          | Alternate |
| --------------- | ---- | ------------ | --------- |
| Definition      | x    | `g+d`        |           |
| Declaration     | x    | `g+shift+d`  |           |
| Implementation  | x    | `g+i`        |           |
| Type definition | x    | `g+t`        |           |
| References      | x    | `g+r`        |           |
| Hover           | x    | `shift+k`    | `shift+s` |
| **Signature**   | x    | `ctrl+k`     | `ctrl+s`  |
| Rename          | x    | `leader+r+n` |           |
| Code action     | x    | `leader+c+a` |           |
| Format          | x+n  | `leader+f`   |           |

TODO:
- [ ] Toggle fold all methods in buffer
- [ ] Toggle fold method in cursor line
- [ ] Use mnemonic p (project), f (file), s (scope/block), l (line)
    - [ ] q for quick (e.g. harpoon)
- [ ] Rename current buffer
