# PDFI.js
[!!! Live Demo !!!](http://www.ivank.net/veci/pdfi/)  PDFI.js is a robust PDF and PostScript processor with a very simple interface.

If you want to render a PDF file, use [pdf.js](https://github.com/mozilla/pdf.js). For all other PDF-related operations, use PDFI.js. The library consists of PSI.js (PostScript Interpreter) and PDFI.js (PDF Interpreter), which is an extension of PSI.js.

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
* `msk` - Image for the mask (can be null)

The Image is a Uint8Array with binary data. If its size is `w * h * 4`, it contains the raw RGBA image. Otherwise, it contains a compressed image (like JPEG, JBIG2, CCITT etc.). If the mask image is present, its color data should be used as the transparency for the main image.

## Graphic State

The Graphic State is an object, containing the current graphic parameters (current path, current fill color, current stroke thickness). The Writer can read these parameters, but it shall not rewrite them.

```javascript
ctm  : [1,0,0,1,0,0],// current transformation matrix
font : Font,         // current text parameters
ca   : 1,            // fill transparency
colr : [0,0,0],      // fill color
CA   : 1,            // stroke transparency
COLR : [0,0,0],      // stroke color
bmode: "/Normal",    // blend mode
lwidt :  1,          // line width
lcap  :  0,          // line cap
ljoin :  0,          // line join
mlimit: 10,          // miter limit
doff: 0, dash: [],   // dashing offset and pattern
pth : Path,          // current path (absolute coordinates)
cpth: Path           // current clipping path (absolute coordinates)
```
## Font object
```javascript
Tc   :   0, // character spacing
Th   : 100, // horizontal scale
Tl   :   0, // leading
Tfs  :   1, // font size
Tf   : "Helvetica-Bold",   // PostScriptName of the required font 
Tm   : [1,0,0,1,0,0]       // transformation matrix
```

## Path object
```javascript
cmds : ["M", "L", "C", "Z"],         // drawing commands (moveTo, lineTo, curveTo, closePath)
crds : [0,0,  1,1,  2,2,3,0,2,1  ]   // coordinates for drawing commands (2 for M and L, 6 for C, 0 for Z)
```

