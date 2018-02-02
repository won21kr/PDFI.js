# PDFI.js
[!!! Live Demo !!!](http://www.ivank.net/veci/pdfi/)  PDFI.js is a robust PDF and PostScript processor with a very simple interface.

If you want to render a PDF file, use [pdf.js](https://github.com/mozilla/pdf.js). For all other PDF-related operations, use PDFI.js.

<img src="interface.svg" width="50%">

## Parsing

#### `PDFI.Parse(b, w)`
* `b`: ArrayBuffer - a binary PDF file
* `w`: a Writer object (e.g. an instance of ToContext2D.js)

A parser (PDFI or PSI) takes a binary file and parses it. During that process, it calls methods of the **writer** (like `w.StartPage(...)`, `w.Fill(...)`, `w.Stroke(...)`, `w.PutText(...)`, `w.PutImage(...)`, `w.ShowPage()` ...). The data of the PDF file flow from the Parser to the Writer by calling these methods.

PDF and PostScript files consist of pages. The parser calls `w.StartPage(...)` at the beginning of each page, and `w.ShowPage()` at the end of each page. `Fill`, `Stroke`, `PutText` and `PutImage` calls can occur in between. The parsing is finished by calling `w.Done()`.

#### `w.StartPage(x0,y0,x1,y1)`
* `x0,y0,x1,y1` - the bounding box of the page

#### `w.ShowPage()`, `w.Done()`
* have no parameters

#### `w.Fill(gst, evenOdd)`
* `gst` - Graphic State
* `evenOdd` - Boolean - filling rule (true: even-odd, false: non-zero)

#### `w.Stroke(gst)`
* `gst`: Graphic State

#### `w.PutText(gst, str, stw)`
* `gst` - Graphic State
* `str` - a string to render
* `stw` - string width (you can ignore it)

#### `w.PutImage(gst, img, w, h, msk)`
* `gst` - Graphic State
* `img` - Image
* `w, h` - image size
* `msk` - Image

The Image is a Uint8Array with binary data. If its size is `w x h x 4`, it contains the raw RGBA image. 
