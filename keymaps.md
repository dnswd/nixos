# Keymaps reference

I'm still trying to find better flow, and I keep editing my keymaps. This is file serve as
quick reference just in case I forget something.

### Kitty

| Description | Key |
| -------------- | --------------- |
| Paste from clipboard | `ctrl+shift+v` |
| Toggle fullscreen | `ctrl+shift+f` |
| Open URL with hints | `ctrl+shift+e` |
| Increase font size | `ctrl+shift+=` or `ctrl+shift++` |
| Decrease font size | `ctrl+shift+-` |
| Reset font size | `ctrl+shift+backspace` |


### Tmux

| Description | Key |
| ----------- | --- |
| Prefix | `ctrl+space` | 
| Enter copy mode | `prefix+c` |
| Begin selection (copy mode) | `v` | 
| Begin rectangle selection (copy mode) | `ctrl+v` |
| Yank selection (copy mode) | `y` |
| List sessions | `prefix+l` |
| New window (tab) | `alt+shift+t` |
| Close window (tab) | `alt+shift+w` |
| Switch next window (tab) | `alt+shift+h` |
| Switch previous window (tab) | `alt+shift+l` |
| Split pane vertically | `alt+|` |
| Split pane horizontally | `alt+-` |
| Close pane | `alt+shift+p` |
| Toggle full window pane | `alt+z` |
| Select pane to the left | `alt+h` |
| Select pane to the right | `alt+l` |
| Select pane to the up | `alt+k` |
| Select pane to the down | `alt+j` |
| Switch n-th window | `alt+${n}` for 1 <= n <= 9 |

TODO: tmux-sessionizer keymap?

### Neovim

| Description | Mode | Key |
| --------------- | --------------- | --------------- |
| Leader | x | space |
| Toggle UndoTree | n | leader+u |
| Find files in project | n | leader+pf |
| Find git files in project | n | leader+pg |
| Find string in project (grep) | n | leader+ps |
| Toggle nvim-tree (file tree) | n | leader+v |
| Open lazygit | n | leader+gg |
| Move highlighted lines upwards | v | shift+j |
| Move highlighted lines downwards | v | shift+k |
| Preprend cursor line with line below | n | shift+j |
| Page up but keep cursor in the middle | n | ctrl+u |
| Page down but keep cursor in the middle | n | ctrl+d |
| Next search but keep cursor in the middle | n | n |
| Previous search but keep cursor in the middle | n | shift+n |
| Paste wihout replacing register content | n | leader+p |
| Delete to void | n+v | leader+d |
| Yank to system register | n+v | leader+y |
| Yank to system register | n | leader+shift+y |
| Next error | n | leader+k |
| Next error | n | leader+k |
| Next error in quickfix | n | ctrl+k |
| Previous error in quickfix | n | ctrl+j |
| Substitute work under cursor | n | leader+s |
| New tmux session via tmux-sessionizer | n | ctrl+f |
| Make current file executable | n | leader+x |
| Add file to harpoon | n | leader+q+a |
| Toggle harpoon menu | n | leader+q+q |
| Switch harpoon registry 1 | n | ctrl+j |
| Switch harpoon registry 2 | n | ctrl+k |
| Switch harpoon registry 3 | n | ctrl+l |
| Switch harpoon registry 4 | n | ctrl+; |
| Toggle codeium chat | n | leader+shift+c |

| Description | Mode | Key |
| --------------- | --------------- | --------------- |
| Scroll completion docs up | n | ctrl+f |
| Scroll completion docs down | n | ctrl+d |
| Scroll completion | n | ctrl+i |
| Dismiss completion | n | leader+shift+ c |
| Select completion | n | enter |
| Scroll completion down or jump next snippet region | n | tab |
| Scroll completion up or jump previous snippet region | n | shift+tab |

### LSP

| Description | Mode | Key |
| --------------- | --------------- | --------------- |
| Definition | x | g+d |
| Declaration | x | g+shift+d |
| Implementation | x | g+i |
| Type definition | x | g+t |
| References | x | g+r |
| Hover | x | shift+k |
| Signature | x | ctrl+k |
| Rename | x | leader+r+n |
| Code action | x | leader+c+a |
| Format | x+n | leader+f |

TODO:
- [ ] Toggle fold all methods in buffer
- [ ] Toggle fold method in cursor line
- [ ] Use mnemonic p (project), f (file), s (scope/block), l (line)

