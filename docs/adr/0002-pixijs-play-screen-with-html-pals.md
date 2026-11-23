# PixiJS play screen with HTML pals

The play screen draws the highway, the notes, the rings, and the hit effects with PixiJS (WebGL), while the pals are HTML images above the canvas, and the menus and the parent area are Solid and HTML as in Pile Pals. Many effects at 60 fps need a GPU renderer, and the shell reuses the tested Pile Pals code. A full game engine would duplicate the shell. The pals stay in HTML so that the pal art can change from still SVG images to animated images with no change to the renderer.
