	
	
	
	
	function PDFI ()
	{
	}
	
	PDFI.Parse = function(buff, genv)
	{
		buff = new Uint8Array(buff);
		
		var offset = buff.length-5;
		while(PSI.B.readASCII(buff,offset,5) != "%%EOF") offset--;
		
		var eoff = offset;
		
		offset--;
		while( PSI.isEOL(buff[offset])) offset--;
		while(!PSI.isEOL(buff[offset])) offset--;
		
		var xref = parseInt(PSI.B.readASCII(buff, offset+1, eoff-offset-1));
		
		if(isNaN(xref)) throw "e";
		
		var xr = [];
		var tr = PDFI.readXrefTrail(buff, xref, xr);
		
		//console.log(xr);
		
		var file = {buff:buff, off:0}, rt = tr["/Root"];
		if(rt.typ=="ref") tr["/Root"] = PDFI.getIndirect(rt.ind,rt.gen,file,xr)
		var ps = tr["/Root"]["/Pages"];
		if(ps.typ=="ref") tr["/Root"]["/Pages"] = PDFI.getIndirect(ps.ind,ps.gen,file,xr)
		
		//console.log(tr);
		
		var stk = [tr["/Root"]["/Pages"]];
		
		while(stk.length!=0) {
			var pg = stk.pop();
			if(pg["/Type"]=="/Pages") {
				var ks = pg["/Kids"];
				for(var i=0; i<ks.length; i++) {
					if(ks[i].typ=="ref") ks[i] = PDFI.getIndirect(ks[i].ind,ks[i].gen,file,xr)
					stk.push(ks[i]);
				}
			}
		}
		
		var time = Date.now();
		PDFI.render(tr["/Root"], genv);
		genv.Done();
		//console.log(Date.now()-time);
	}
	PDFI.render = function(root, genv)
	{
		var rbb = root["/Pages"]["/MediaBox"];
		
		var ops = [
			"CS","cs","SCN","scn","SC","sc","sh",
			"Do", "gs", "ID","EI", "re","cm","y","v","B","B*",  "BT","ET",
			"Tj","TJ","Tf","Tm","Td","T*",
			"Tc","Tw","Tz","TL","Tr","Ts",
			"MP","DP","BMC","BDC","EMC","BX","EX",  "ri"
		];
		
		var prcs = {
			"J":"setlinecap",
			"j":"setlinejoin",
			"w":"setlinewidth",
			"d":"setdash",
			"M":"setmiterlimit",
			"i":"setflat",
			"q":"gsave",  "Q":"grestore",
			"m":"moveto",  "l":"lineto",  "c":"curveto", "h":"closepath",
			"W":"clip",  "W*":"eoclip",
			"f":"fill","F":"fill","f*":"eofill", "S":"stroke",
			"n":"newpath",
			
			"RG" : "/DeviceRGB  CS SCN",
			"rg" : "/DeviceRGB  cs scn",
			"G"  : "/DeviceGray CS SCN",
			"g"  : "/DeviceGray cs scn",
			"K"  : "/DeviceCMYK CS SCN",
			"k"  : "/DeviceCMYK cs scn",
			
			"TD" : "dup neg TL Td",
			"\"" : "exch Tc exch Tw '",
			"'"  : "T* Tj",
			
			"s"  : "h S",
			"BI" : "/BI"
		}
		prcs = PSI.makeProcs(prcs);
		
		var stk = [root["/Pages"]], pi=0;
		
		while(stk.length!=0) {
			var pg = stk.pop();
			
			if(pg["/Type"]=="/Pages") {
				var ks = pg["/Kids"];
				for(var i=ks.length-1; i>=0; i--) stk.push(ks[i]);
				continue;
			}
			pi++;  //if(pi!=2) continue;  
			
			var cts = pg["/Contents"];   //console.log(pg);
			if(cts.length==null) cts = [cts];
			
			var bb = pg["/MediaBox"];  if(bb==null) bb = rbb;
			var env = PSI._getEnv(bb);  env.pgOpen = true;
			var gs = [];
			var os = [];	// operand stack
			var ds = PSI._getDictStack(ops, prcs);
			var es = [];
			
			genv.StartPage(bb[0],bb[1],bb[2],bb[3]);
			for(var j=0; j<cts.length; j++)
			{
				var cnt = cts[j]["stream"];
				//console.log(PSI.B.readASCII(cnt,0,cnt.length));
				es.push({  typ:"file", val: {  buff:cnt, off:0, extra:pg  }  });	// execution stack
				var repeat = true;
				while(repeat) repeat = PSI.step(os, ds, es, gs, env, genv, PDFI.operator);
			}
			genv.ShowPage();  //if(pi>23) break;
		}
	}
	PDFI.operator = function(op, os, ds, es, gs, env, genv)
	{
		//console.log(op);
		var gst = env.gst;
		var lfi = es.length-1;  while(es[lfi].typ!="file") lfi--;
		var fle = es[lfi].val;
		var res = fle.extra["/Resources"];
		if(op=="Do") {
			var nam = os.pop().val, xo = res["/XObject"][nam];
			//console.log(xo);
			var st=xo["/Subtype"], stm = xo["stream"];
			if(st=="/Form")  {
				//console.log(PSI.B.readASCII(stm,0,stm.length));
				es.push( {typ:"file", val: { buff:stm, off:0, extra:xo }}  );
			}
			else if(st=="/Image")  {
				var sms = null;  //console.log(xo);
				if(xo["/SMask"]) sms = PDFI.getImage(xo["/SMask"], gst);
				var w=xo["/Width"], h=xo["/Height"], cs=xo["/ColorSpace"];
				var img = PDFI.getImage(xo, gst);
				if(xo["/ImageMask"]==true) {
					sms = img;
					img = new Uint8Array(w*h*4), r0 = gst.colr[0]*255, g0 = gst.colr[1]*255, b0 = gst.colr[2]*255;
					for(var i=0; i<w*h*4; i+=4) {  img[i]=r0;  img[i+1]=g0;  img[i+2]=b0;  img[i+3]=255;  }
				}
				genv.PutImage(gst, img, w,h, sms);
			}
			else console.log("Unknown XObject",st);
		}
		else if(op=="gs") {
			var nm = os.pop().val;
			var egs = res["/ExtGState"][nm];
			for(var p in egs) {
				var v = egs[p];
				if(p=="/Type") continue;
				else if(p=="/CA") gst.CA=v;
				else if(p=="/ca") gst.ca=v;
				else if(p=="/BM") gst.bmode = v;
				else if(p=="/LC") gst.lcap  = v;
				else if(p=="/LJ") gst.ljoin = v;
				else if(p=="/LW") gst.lwidth = v;
				else if(p=="/ML") gst.mlimit = v;
				else if(p=="/SA") gst.SA = v;
				else if(p=="/OPM")gst.OPM = v;
				else if(p=="/AIS")gst.AIS = v;
				else if(p=="/OP") gst.OP = v;
				else if(p=="/op") gst.op = v;
				else if(p=="/SMask") {  gst.SMask = "";  }
				else if(p=="/SM") gst.SM = v;
				else if(p=="/BG" || p=="/HT" || p=="/TR" || p=="/UCR") {}
				else console.log("Unknown gstate property: ", p, v);
			}
		}
		else if(op=="ID") {
			var dic = {};
			while(true) {  var v = os.pop().val;  if(v=="/BI") break;  dic[os.pop().val] = v;  }    fle.off++;
			var w=dic["/W"], h=dic["/H"], ar=w*h, img = new Uint8Array(ar*4), cs = dic["/CS"], bpc = dic["/BPC"];
			var end = fle.off;
			while(!PSI.isWhite(fle.buff[end]) || fle.buff[end+1]!=69 || fle.buff[end+2]!=73) end++;
			var stm = fle.buff.slice(fle.off, end);  fle.off+=stm.length;
			if(dic["/F"]=="/Fl") {  stm = PSI.F.FlateDecode({buff:stm, off:0});  delete dic["/F"];  }
			if(cs=="/G" && dic["/F"]==null) {
				PDFI.plteImage(stm, 0, img, null, w, h, bpc);
			}
			else if(cs[0].typ!=null) {
				PDFI.plteImage(stm, 0, img, cs[3].val, w, h, bpc);
			}
			else img = stm;
			genv.PutImage(gst, img, w,h);
		}
		else if(op=="n" || op=="BT" || op=="EI") {}
		else if(op=="ET") {  gst.font.Tm = [1,0,0,1,0,0];  gst.font.Tlm=gst.font.Tm.slice(0);  }
		else if(op=="re") {
			var h=os.pop().val, w=os.pop().val, y=os.pop().val, x=os.pop().val;
			PSI.G.moveTo(gst,x,y);  PSI.G.lineTo(gst,x+w,y);  PSI.G.lineTo(gst,x+w,y+h);  PSI.G.lineTo(gst,x,y+h);  PSI.G.closePath(gst);
		}
		else if(op=="y" || op=="v") {
			var im=gst.ctm.slice(0);  PSI.M.invert(im);  var p=PSI.M.multPoint(im,gst.cpos);  
			var y3=os.pop().val, x3=os.pop().val, y1=os.pop().val, x1=os.pop().val;
			if(op=="y") PSI.G.curveTo(gst,x1,y1,x3,y3,x3,y3);
			else        PSI.G.curveTo(gst,p[0],p[1],x1,y1,x3,y3);
		}
		else if(op=="B" || op=="B*") {
			genv.Fill(gst, op=="B*");    //PSI.G.newPath(gst);
			genv.Stroke(gst);  PSI.G.newPath(gst);
		}
		else if(op=="cm" || op=="Tm") {
			var m = [];  for(var i=0; i<6; i++) m.push(os.pop().val);    m.reverse();  
			
			if(op=="cm") {  PSI.M.concat(m, gst.ctm);  gst.ctm = m;    }
			else         {  gst.font.Tm = m;  gst.font.Tlm = m.slice(0);  }
		}
		else if(op=="Td" || op=="T*") {
			var x=0, y=0;
			if(op=="T*") { x=0; y=-gst.font.Tl; }
			else { y=os.pop().val;  x=os.pop().val; }
			var tm = [1,0,0,1,x,y];  PSI.M.concat(tm,gst.font.Tlm);
			gst.font.Tm = tm;  gst.font.Tlm = tm.slice(0);
		}
		else if(op=="Tf") {
			var sc = os.pop().val, fnt = os.pop().val;
			gst.font.Tf=fnt;//rfnt["/BaseFont"].slice(1);
			gst.font.Tfs=sc;  //os.push(fnt);
		}
		else if(op=="Tj" || op=="TJ") {
			var sar = os.pop();
			if(sar.typ=="string") sar = [sar];
			else sar = sar.val;
			
			var rfnt = res["/Font"][fnt];
			
			var tf = gst.font.Tf;
			var fnt = res["/Font"][tf];
			var scl = PSI.M.getScale(gst.font.Tm)*gst.font.Tfs/1000;
			
			for(var i=0; i<sar.length; i++) {
				//if(sar[i].typ!="string") {  gst.font.Tm[4] += -scl*sar[i].val;  continue;  }
				if(sar[i].typ!="string") {  if(i==0) gst.font.Tm[4] += -scl*sar[i].val;  continue;  }
				var str = PDFI.getString(sar[i].val, fnt);
				if(sar[i+1] && sar[i+1].typ!="string") {  var sv = sar[i+1].val;  str[1] += -sv;  if(-900<sv && sv<-100) str[0]+=" ";  }
				
				gst.font.Tf = str[2];
				genv.PutText(gst, str[0], str[1]/1000);  //gst.cpos[0] += str.length*gst.font.mat[0]*0.5;  
				gst.font.Tf = tf;
				gst.font.Tm[4] += scl*str[1];
			}
		}
		else if(op=="Tc") gst.font.Tc = os.pop().val;
		else if(op=="Tw") gst.font.Tw = os.pop().val;
		else if(op=="Tz") gst.font.Th = os.pop().val;
		else if(op=="TL") gst.font.Tl = os.pop().val;
		else if(op=="Tr") gst.font.Tmode = os.pop().val;
		else if(op=="Ts") gst.font.Trise = os.pop().val;
		else if(op=="CS"  || op=="cs" ) {  var cs = os.pop().val;  if(op=="CS") gst.sspace=cs;  else gst.space=cs;  }
		else if(op=="SCN" || op=="scn" || op=="SC" || op=="sc") {
			var stk = (op=="SCN" || op=="SC");
			var csi =  stk ? gst.sspace : gst.space, cs, c = null;
			//console.log(op, cs, os);  throw "e";
			var sps = res ? res["/ColorSpace"] : null;  //if(sps!=null) console.log(sps[csi]);
			if(sps!=null && sps[csi]!=null) {
				if(sps[csi][1] && sps[csi][1]["/Alternate"])  cs = sps[csi][1]["/Alternate"];  //cs = sps[csi][0];
				else cs = sps[csi][0];
			}
			else cs = csi;
			//console.log(res, cs, os);
			if(cs=="/Lab" || cs=="/ICCBased" || cs=="/DeviceRGB" || cs=="/DeviceN") {  c=[os.pop().val, os.pop().val, os.pop().val];  c.reverse();  }
			else if(cs=="/DeviceCMYK") {  var cmyk=[os.pop().val,os.pop().val,os.pop().val,os.pop().val];  cmyk.reverse();  c = PSI.C.cmykToRgb(cmyk);  }
			else if(cs=="/DeviceGray" || cs=="/CalGray") {  var gv=PSI.nrm(os.pop().val);  c=[gv,gv,gv];  }
			else if(cs=="/Separation") {  var lab = PDFI.Func(sps[csi][3], [os.pop().val]);  c = PSI.C.labToRgb(lab);  }
			else if(cs=="/Pattern")    {  
				//*
				var pt = res["/Pattern"][os.pop().val];  //console.log(pt);
				var ptyp = pt["/PatternType"];
				if(ptyp==1) {  console.log("tile pattern");  return;  }
				PDFI.setShadingFill(pt["/Shading"], pt["/Matrix"], stk, gst);
				return;//*/  os.pop();  c=[1,0.5,0]; 
			}
			else {  console.log(cs, os, sps, res);  throw("e");  }
			//console.log(c);
			if(stk) gst.COLR = c;  else gst.colr=c;
		}
		else if(op=="sh")  {  //os.pop();  return;
			//if(window.asdf==null) window.asdf=0;
			//window.asdf++;  if(window.asdf!=6) return;
			var sh = res["/Shading"][os.pop().val];  //console.log(sh);
			var ocolr = gst.colr, opth = gst.pth;
			gst.pth = gst.cpth;
			PDFI.setShadingFill(sh, gst.ctm.slice(0), false, gst);
			genv.Fill(gst);
			gst.colr = ocolr;  gst.pth = opth;
		}
		else if(op=="MP" || op=="BMC" || op=="ri") {  os.pop();  }
		else if(op=="DP" || op=="BDC") {  os.pop();  os.pop();  }
		else if(op=="EMC"|| op=="BX" || op=="EX") {  }
		else 
			throw ("Unknown operator", op);
		
	}

	
	PDFI.setShadingFill = function(sh, mat, stk, gst)
	{
		var styp = sh["/ShadingType"], cs = sh["/ColorSpace"];
		//console.log(cs);
		//if(cs!="/DeviceRGB") throw "unknown shading space " + cs;	
		var ftyp = "";
		if(styp==2) {
			ftyp="lin";
		}
		else if(styp==3) {
			ftyp="rad";
		}
		else {  console.log("Unknown shading type", styp);  return;  }
		
		var fill = {typ:ftyp, mat:mat, grad:PDFI.getGrad(sh["/Function"]), crds:sh["/Coords"]}
		
		if(stk) gst.COLR = fill;  else gst.colr=fill;
	}
	
	PDFI.getGrad = function(fn) {
		var fs = fn["/Functions"], ft = fn["/FunctionType"], bs = fn["/Bounds"], enc = fn["/Encode"];
		if(ft==0 || ft==2) return [   [0,PDFI.Func(fn,[0])],  [1,PDFI.Func(fn,[1])]   ];
		var zero = enc[0];
		var grd = [];
		if(bs.length==0 || bs[0]>0) grd.push([0, PDFI.Func(fs[0], [zero])] );
		for(var i=0; i<bs.length; i++)  grd.push([bs[i], PDFI.Func(fs[i],[zero])]);
		if(bs.length==0 || bs[bs.length-1]<1) grd.push([1, PDFI.Func(fs[fs.length-1], [1-zero])]);
		//console.log(fn, grd);
		return grd;
	}
	PDFI._clrSamp = function(stm, i) {  return [stm[i]/255, stm[i+1]/255, stm[i+2]/255];  }
	
	PDFI.getImage = function(xo, gst) {
		var w=xo["/Width"], h=xo["/Height"], ar = w*h, ft=xo["/Filter"], cs=xo["/ColorSpace"], bpc=xo["/BitsPerComponent"], stm=xo["stream"];
		var img = xo["image"];  //console.log(xo);
		if(img==null) {
			var msk = xo["/Mask"];
			if(cs && cs[0]=="/Indexed") {
				var pte;
				if(cs[3].length!=null) {	// palette in a string
					var str = cs[3];  pte = new Uint8Array(256*3);
					for(var i=0; i<str.length; i++) pte[i] = str.charCodeAt(i);
				}							
				else pte = cs[3]["stream"];
				var nc = new Uint8Array(ar*4);
				PDFI.plteImage(stm, 0, nc, pte, w, h, bpc, msk);
				img=nc;
			}
			else if(ft==null && cs && cs=="/DeviceGray") {
				var pte = [0,0,0,255,255,255], nc = new Uint8Array(ar*4);
				if(xo["/Decode"] && xo["/Decode"][0]==1) {  pte.reverse();  }
				if(xo["/ImageMask"]==true)  pte.reverse();
				PDFI.plteImage(stm, 0, nc, bpc==1?pte:null, w, h, bpc, msk);
				img=nc;
			}
			else if(w*h*3<=stm.length) {
				var nc = new Uint8Array(ar*4);
				for(var i=0; i<ar; i++) {  var ti=i*3, qi=i*4;  nc[qi]=stm[ti];  nc[qi+1]=stm[ti+1];  nc[qi+2]=stm[ti+2];  nc[qi+3]=255;  }
				img = nc;
			}
			else {  img = stm;  }
			xo["image"] = img;
		}
		return img;
	}
	PDFI.plteImage = function(buff, off, img, plt, w, h, bpc, msk)
	{
		var mlt = Math.round(255/((1<<bpc)-1));
		var bpl = Math.ceil(w*bpc/8);
		for(var y=0; y<h; y++) {
			var so = off + bpl * y; 
			for(var x=0; x<w; x++) {  
				var ci = 0;
				if     (bpc==8) ci = buff[so+x];
				else if(bpc==4) ci=(buff[so+(x>>1)]>>((1-(x&1))<<2))&15;
				else if(bpc==2) ci=(buff[so+(x>>2)]>>((3-(x&3))<<1))&3;  
				else if(bpc==1) ci=(buff[so+(x>>3)]>>((7-(x&7))<<0))&1;
				var qi = (y*w+x)<<2;  
				if(plt) {  var c =ci*3;    img[qi]=plt[c];  img[qi+1]=plt[c+1];  img[qi+2]=plt[c+2];  }
				else    {  var nc=ci*mlt;  img[qi]=nc;      img[qi+1]=nc;        img[qi+2]=nc;        }
				img[qi+3]=255;  
				if(msk && msk[0]<=ci && ci<=msk[1]) img[qi+3]=0; 
			}
		}
	}
	
	PDFI.Func = function(f, vls)
	{
		var dom = f["/Domain"], rng = f["/Range"], typ = f["/FunctionType"], out = [];
		for(var i=0; i<vls.length; i++) vls[i]=Math.max(dom[2*i], Math.min(dom[2*i+1], vls[i]));
		if(typ==0) {
			var enc = f["/Encode"], sz = f["/Size"], dec = f["/Decode"], n = rng.length/2;
			if(enc==null) enc=[0,sz[0]-1];
			if(dec==null) dec=[0,sz[0]-1,0,sz[0]-1,0,sz[0]-1];
			
			for(var i=0; i<vls.length; i++) {
				var ei = PDFI.intp(vls[i],dom[2*i],dom[2*i+1],enc[2*i],enc[2*i+1]);
				vls[i] = Math.max(0, Math.min(sz[i]-1, ei));
			}
			for(var j=0; j<n; j++) {
				var x = Math.round(vls[0]), rj = f["stream"][n*x+j];
				rj = PDFI.intp(rj, 0,255, dec[2*j],dec[2*j+1]);
				out.push(rj);
			}
		}
		else if(typ==2) {
			var c0=f["/C0"],c1=f["/C1"],N=f["/N"]
			var x = vls[0];
			for(var i=0; i<c0.length; i++) out[i] = c0[i] + Math.pow(x,N) * (c1[i]-c0[i]);
		}
		else throw "e";
		
		if(rng) for(var i=0; i<out.length; i++) out[i]=Math.max(rng[2*i], Math.min(rng[2*i+1], out[i]));
		return out;
	}
	PDFI.intp = function(x,xmin,xmax,ymin,ymax) {  return ymin + (x-xmin) * (ymax-ymin)/(xmax-xmin);  }
	
	PDFI.getString = function(sv, fnt)
	{
		//console.log(sv, fnt);  //throw "e";
		
		var st = fnt["/Subtype"], s="", m=0, psn=null;
		var tou = fnt["/ToUnicode"], enc = fnt["/Encoding"], sfnt=fnt;	// font with a stream
		if(st=="/Type0") sfnt = fnt["/DescendantFonts"][0];  // // only in type 0
		
		if(tou!=null) s = PDFI.toUnicode(sv, tou);
		else if(enc=="/WinAnsiEncoding") s = PDFI.fromWin(sv);
		else if(st=="/Type0") {
			var off=0;
			if(enc=="/Identity-H") off=31;
			for(var j=0; j<sv.length; j+=2) {
				var gid = (sv[j]<<8)|sv[j+1];  //console.log(gid, stm);
				s += String.fromCharCode(gid+off);  // don't know why 31
			}
		}
		else if(enc!=null && enc["/Type"]=="/Encoding") {
			var dfs = enc["/Differences"];
			if(dfs) {
				var s = "";
				for(var i=0; i<sv.length; i++) {
					var ci = sv[i], coff=-5;
					for(var j=0; j<dfs.length; j++)
					{
						if(typeof dfs[j] == "string") {  if(ci==coff) s+=PDFI.fromCName(dfs[j].slice(1));  coff++;  }
						else coff=dfs[j];
					}
				}
			}
			//console.log(enc, sv);	throw "e";
			//s = PDFI.fromWin(sv);
		}
		else {  /*console.log("reading simple string", sv, fnt);*/  s = PSI.readStr(sv);  }
		
		
		if(st=="/Type0") {
			//console.log(df);  //throw "e";
			var ws = sfnt["/W"];
			//console.log(sv, fnt);
			for(var i=0; i<sv.length; i+=2) {
				var cc = (sv[i]<<8)|sv[i+1], gotW = false;
				for(var j=0; j<ws.length; j+=2) {
					var i0=ws[j], i1 = ws[j+1];
					if(i1.length) {   if(0<=cc-i0 && cc-i0<i1.length) {  m += i1[cc-i0];  gotW=true;  }   }
					else {  if(i0<=cc && cc<=i1) {  m += ws[j+2];  gotW = true;  }  j++;  }
				}
				if(!gotW) m += ws[1][0];
			}
		}
		else if(st=="/Type1" || st=="/TrueType") {
			var fc=fnt["/FirstChar"], ws = fnt["/Widths"];
			if(ws)	for(var i=0; i<sv.length; i++) m += ws[sv[i]-fc];
			else    {  m = s.length*1000*0.4;  console.log("approximating word width");  }
		}
		else throw "e";
		
		//console.log(fnt);//  throw "e";
		//console.log(sfnt);
		var fd = sfnt["/FontDescriptor"];
		if(fd) {
			if(fd["psName"]) psn=fd["psName"];
			else {
				var pp, ps = ["","2","3"];
				for(var i=0; i<3; i++) if(fd["/FontFile"+ps[i]]) pp = "/FontFile"+ps[i];
				if(pp) {
					var fle = fd[pp]["stream"];
					if(pp!=null && fle && PSI.B.readUint(fle,0)==65536) psn = fd["psName"] = PDFI._psName(fle);
				}
			}
		}
		if(psn==null) psn = fnt["/BaseFont"].slice(1);
		return [s, m, psn.split("+").pop()];
	}
	PDFI._psName = function(fle) {
		var rus = PSI.B.readUshort;
		var num = rus(fle, 4);
		
		var noff = 0;
		for(var i=0; i<num; i++) {
			var tn = PSI.B.readASCII(fle,12+i*16,4), to = PSI.B.readUint(fle, 12+i*16+8);
			if(tn=="name") {  noff=to;  break;  }
		}
		if(noff==0) return null;

		var cnt=rus(fle, noff+2);
		var offset0=noff+6, offset=noff+6;
		for(var i=0; i<cnt; i++) {
			var platformID = rus(fle, offset   );
			var eID        = rus(fle, offset+ 2);	// encoding ID
			var languageID = rus(fle, offset+ 4);
			var nameID     = rus(fle, offset+ 6);
			var length     = rus(fle, offset+ 8);
			var noffset    = rus(fle, offset+10);
			offset += 12;
			
			var s;
			var soff = offset0 + cnt*12 + noffset;
			if(eID==1 || eID==10 || eID==3) {  s="";  for(var j=1; j<length; j+=2) s += String.fromCharCode(fle[soff+j]);  }
			if(eID==0 || eID== 2) s = PSI.B.readASCII(fle, soff, length);
			if(nameID==6 && s!=null && s.slice(0,3)!="OTS") return s.replace(/\s/g, "");
		}
		return null;
	}
	PDFI.fromWin = function(sv)
	{
		var map = PDFI._win1252;  s="";
		for(var j=0; j<sv.length; j++) {
			var cc = sv[j], ci = map.indexOf(cc);
			if(ci!=-1) cc = map[ci+1];
			s+=String.fromCharCode(cc);
		}
		return s;
	}
	PDFI.fromCName = function(cn)
	{
		if(cn.length==1) return cn;
		if(cn.slice(0,3)=="uni") return String.fromCharCode(parseInt(cn.slice(3),16));
		//var gi = parseInt(cn.slice(1));  if(cn.charAt(0)=="g" && !isNaN(gi)) return String.fromCharCode(gi);
		var map = {
			"space":32,"exclam":33,"quotedbl":34,"numbersign":35,"dollar":36,"percent":37,"parenleft":40,
			"parenright":41,"asterisk":42,"plus":43,"comma":44,"hyphen":45,"period":46,"slash":47,
			"zero":48,"one":49,"two":50,"three":51,"four":52,"five":53,"six":54,"seven":55,"eight":56,"nine":57,
			"colon":58,"semicolon":59,"less":60,"equal":61,"at":64,
			"bracketleft":91,"bracketright":93,"underscore":95,"braceleft":123,"braceright":125,
			"dieresis":168,"circlecopyrt":169,"Eacute":201,
			"dotlessi":0x0131,
			"alpha":0x03B1,"phi":0x03C6,
			"endash":0x2013,"emdash":0x2014,"asteriskmath":0x2217,"quoteright":0x2019,"quotedblleft":0x201C,"quotedblright":0x201D,"bullet":0x2022,
			"minus":0x2202,
			"fi": 0xFB01,"fl":0xFB02 };
		var mc = map[cn];
		if(mc==null) {  if(cn.charAt(0)!="g") console.log("unknown character "+cn);  
			return cn;  }
		return String.fromCharCode(mc);
	}
	
	PDFI.toUnicode = function(sar, tou) {
		var cmap = tou["cmap"], s = "";
		if(cmap==null) {
			var file = {buff:tou["stream"], off:0};
			//console.log(PSI.B.readASCII(file.buff, 0, file.buff.length));
			var os = [];	// operand stack
			var ds = PSI._getDictStack({});
			var es = [{  typ:"file", val: file  }];	// execution stack
			var gs = [];
			var env = PSI._getEnv([0,0,1,1]);  env.pgOpen = true;
			var time = Date.now();
			var repeat = true;
			while(repeat) repeat = PSI.step(os, ds, es, gs, env, null, PDFI.operator);
			cmap = env.res["CMap"];
			tou["cmap"] = cmap;
			//console.log(cmap);  throw "e";
		}
		//console.log(cmap);
		//cmap = cmap["Adobe-Identity-UCS"];
		for(var p in cmap) {  cmap=cmap[p];  break;  }
		//console.log(cmap, sar);  throw "e";
		var bfr = cmap.bfrange, bfc = cmap.bfchar, bpc = cmap["bpc"];
		for(var i=0; i<sar.length; i+=bpc) {
			var cc = sar[i];  if(bpc==2) cc = (cc<<8) | sar[i+1];
			var mpd = false;
			if(!mpd && bfr) for(var j=0; j<bfr.length; j+=3) {
				var v0=bfr[j], v1=bfr[j+1], v2=bfr[j+2];
				if(v0<=cc && cc<=v1) {  
					if(v2.length==null) cc+=v2-v0;  
					else cc = v2[cc-v0];
					mpd=true;  break;  
				}
			}
			if(!mpd && bfc) for(var j=0; j<bfc.length; j+=2) if(bfc[j]==cc) {  cc=bfc[j+1];  mpd=true;  break;  }
			s += String.fromCharCode(cc);
		}
		return s;
	}
	PDFI._win1252 = [ 0x80, 0x20AC, 0x82, 0x201A, 0x83, 0x0192,	0x84, 0x201E, 0x85, 0x2026, 0x86, 0x2020, 0x87, 0x2021, 0x88, 0x02C6, 0x89, 0x2030,
0x8A, 0x0160, 0x8B, 0x2039, 0x8C, 0x0152, 0x8E, 0x017D, 0x91, 0x2018, 0x92, 0x2019, 0x93, 0x201C, 0x94, 0x201D, 0x95, 0x2022, 0x96, 0x2013,
0x97, 0x2014, 0x98, 0x02DC, 0x99, 0x2122, 0x9A, 0x0161, 0x9B, 0x203A, 0x9C, 0x0153, 0x9E, 0x017E, 0x9F, 0x0178	];
	
	PDFI.readXrefTrail = function(buff, xref, out)
	{
		var kw = PSI.B.readASCII(buff, xref, 4);
		if(kw=="xref") {
			var off = xref+4;  
			if(buff[off]==13) off++;  if(buff[off]==10) off++;
			while(true) {	// start of the line with M, N
				var of0 = off;
				while(!PSI.isEOL(buff[off])) off++;  
				var line = PSI.B.readASCII(buff,  of0, off-of0);  //console.log(line);  
				if(line=="trailer") break;  line = line.split(" ");
				var n = parseInt(line[1]);
				if(buff[off]==13) off++;  if(buff[off]==10) off++;
				for(var i=0; i<n; i++)
				{
					var li = parseInt(line[0])+i;
					if(out[li]==null) out[li] = {
						off: parseInt(PSI.B.readASCII(buff, off, 10)),
						gen: parseInt(PSI.B.readASCII(buff, off+11, 5)),
						chr: PSI.B.readASCII(buff, off+17, 1),
						val: null,
						opn: false
					};
					off+=20;
				}
			}
			var file = {buff:buff, off:off};//, trw = PSI.getFToken(file);
			var trl = PDFI.readObject(file, file, out);
			if(trl["/Prev"]) PDFI.readXrefTrail(buff, trl["/Prev"], out);
			return trl;
		}
		else {
			var off = xref;
			while(!PSI.isEOL(buff[off])) off++;   off++;
			
			var xr = PDFI.readObject({buff:buff, off:off}, file, null);  //console.log(xr);
			var sof = 0, sb = xr["stream"], w = xr["/W"], ind = (xr["/Index"] ? xr["/Index"][0] : 0);
			while(sof<sb.length) {
				var typ=PDFI.getInt(sb,sof,w[0]);  sof+=w[0];
				var a  =PDFI.getInt(sb,sof,w[1]);  sof+=w[1];
				var b  =PDFI.getInt(sb,sof,w[2]);  sof+=w[2];
				var off=0, gen=0, chr="n";
				if(typ==0) {off=a;  gen=b;  chr="f";}
				if(typ==1) {off=a;  gen=b;  chr="n";}
				if(typ==2) {off=a;  gen=b;  chr="s";}
				out[ind] = { off: off, gen: gen, chr: chr, val: null, opn: false };  ind++;
			}
			if(xr["/Prev"]) PDFI.readXrefTrail(buff, xr["/Prev"], out);
			//*
			var fl = {buff:buff, off:0};
			var ps = ["/Root","/Info"];
			for(var i=0; i<ps.length; i++) {
				var p = ps[i], val = xr[p];
				if(val && val.typ=="ref") xr[p] = PDFI.getIndirect(val.ind, val.gen, fl, out);
			}
			//*/
			return xr;
		}
	}
	PDFI.getInt = function(b,o,l) {
		if(l==1) return b[o];
		if(l==2) return ((b[o]<< 8)|b[o+1]);
		if(l==3) return ((b[o]<<16)|(b[o+1]<<8)|b[o+2]);   throw "e";
	}
	
	PDFI.getIndirect = function(i,g,file,xr)
	{
		var xv = xr[i];
		if(xv.chr=="f") return null;
		if(xv.val!=null) return xv.val;
		if(xv.opn) return {typ:"ref",ind:i, gen:g};
		
		xv.opn = true;
		var ooff = file.off, nval;
		
		if(xv.chr=="s") {
			var os = PDFI.getIndirect(xv.off, xv.gen, file, xr), fle = {buff:os["stream"], off:0};
			var idx=0, ofs=0;
			while(idx!=i) {  idx=PSI.getFToken(fle).val;  ofs=PSI.getFToken(fle).val;  }
			fle.off = ofs+os["/First"];
			nval = PDFI.readObject(fle, file, xr);
		}
		else {
			file.off = xv.off;
			var a=PSI.getFToken(file), b=PSI.getFToken(file), c=PSI.getFToken(file);
			//console.log(a,b,c);
			nval = PDFI.readObject(file, file, xr);
		}
		
		xv.val = nval;
		file.off = ooff;  xv.opn = false;
		return nval;
	}
	
	PDFI.readObject = function(file, mfile, xr) 
	{
		//console.log(file.off, file.buff);
		var tok = PSI.getFToken(file);
		//console.log(tok);
		if(tok.typ=="integer") {
			var off = file.off;
			var tok2 = PSI.getFToken(file);
			if(tok2.typ=="integer") {
				PSI.skipWhite(file);
				if(file.buff[file.off]==82) {
					file.off++;  
					if(xr && xr[tok.val]) return PDFI.getIndirect(tok.val, tok2.val, mfile, xr);
					else   return {typ:"ref",ind:tok.val, gen:tok2.val};
				}
			}
			file.off = off;
		}
		
		if(tok.val=="<<") return PDFI.readDict(file, mfile, xr);
		if(tok.val=="[" ) return PDFI.readArra(file, mfile, xr);
		if(tok.typ=="string") {
			var s = "";  for(var i=0; i<tok.val.length; i++) s+=String.fromCharCode(tok.val[i]);
			return s;
		}
		return tok.val;
	}
	PDFI.readDict = function(file, mfile, xr) {
		var o = {};
		while(true) {
			var off=file.off, tok = PSI.getFToken(file);
			if(tok.typ=="name" && tok.val==">>") break;
			file.off= off;
			var key = PDFI.readObject(file, mfile, xr);
			var val = PDFI.readObject(file, mfile, xr);
			o[key] = val;
		}
		if(o["/Length"]!=null) {
			var l = o["/Length"];
			var tk = PSI.getFToken(file);  if(file.buff[file.off]==13) file.off++;  if(file.buff[file.off]==10) file.off++;
			
			var buff = file.buff.slice(file.off, file.off+l);  file.off += l;  PSI.getFToken(file); // endstream
			
			var flt = o["/Filter"], prm=o["/DecodeParms"];
			if(flt!=null) {
				var fla = (typeof flt == "string") ? [flt] : flt;
				var keepFlt = false;
				for(var i=0; i<fla.length; i++) {
					var cf = fla[i], fl = {buff:buff, off:0};
					if     (cf=="/FlateDecode"  ) {  buff = PSI.F.FlateDecode(fl);  }
					else if(cf=="/ASCII85Decode") {  buff = PSI.F.ASCII85Decode(fl);  }
					else if(cf=="/DCTDecode" || cf=="/CCITTFaxDecode" || cf=="/JPXDecode" || cf=="/JBIG2Decode") {  keepFlt = true;  }  // JPEG
					else {  console.log(cf, buff);  throw "e";  }
				}
				if(!keepFlt) delete o["/Filter"];
			}
			if(prm!=null) {
				if(prm instanceof Array) prm = prm[0];
				if(prm["/Predictor"]!=null && prm["/Predictor"]!=1) {
					var w = prm["/Columns"], bpp = prm["/Colors"] ? prm["/Colors"]: 1, bpl = (bpp*w), h = (buff.length/(bpl+1));
					PDFI._filterZero(buff, 0, w, h, bpp);  buff = buff.slice(0, h*bpl);
				}
			}
			o["stream"] = buff;
		}
		return o;
	}
	PDFI.readArra = function(file, mfile, xr) {
		var o = [];
		while(true) {
			var off=file.off, tok = PSI.getFToken(file);
			if(tok.typ=="name" && tok.val=="]") return o;
			file.off = off;
			var val = PDFI.readObject(file, mfile, xr);
			o.push(val);
		}
	}
	
	PDFI._filterZero = function(data, off, w, h, bpp) {  // copied from UPNG.js
		var bpl = bpp*w, paeth = PDFI._paeth;

		for(var y=0; y<h; y++)  {
			var i = off+y*bpl, di = i+y+1;
			var type = data[di-1];

			if     (type==0) for(var x=  0; x<bpl; x++) data[i+x] = data[di+x];
			else if(type==1) {
				for(var x=  0; x<bpp; x++) data[i+x] = data[di+x];
				for(var x=bpp; x<bpl; x++) data[i+x] = (data[di+x] + data[i+x-bpp])&255;
			}
			else if(y==0) {
				for(var x=  0; x<bpp; x++) data[i+x] = data[di+x];
				if(type==2) for(var x=bpp; x<bpl; x++) data[i+x] = (data[di+x])&255;
				if(type==3) for(var x=bpp; x<bpl; x++) data[i+x] = (data[di+x] + (data[i+x-bpp]>>1) )&255;
				if(type==4) for(var x=bpp; x<bpl; x++) data[i+x] = (data[di+x] + paeth(data[i+x-bpp], 0, 0) )&255;
			}
			else {
				if(type==2) { for(var x=  0; x<bpl; x++) data[i+x] = (data[di+x] + data[i+x-bpl])&255;  }

				if(type==3) { for(var x=  0; x<bpp; x++) data[i+x] = (data[di+x] + (data[i+x-bpl]>>1))&255;
							  for(var x=bpp; x<bpl; x++) data[i+x] = (data[di+x] + ((data[i+x-bpl]+data[i+x-bpp])>>1) )&255;  }

				if(type==4) { for(var x=  0; x<bpp; x++) data[i+x] = (data[di+x] + paeth(0, data[i+x-bpl], 0))&255;
							  for(var x=bpp; x<bpl; x++) data[i+x] = (data[di+x] + paeth(data[i+x-bpp], data[i+x-bpl], data[i+x-bpp-bpl]) )&255;  }
			}
		}
		return data;
	}
	
	PDFI._paeth = function(a,b,c) {
		var p = a+b-c, pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c);
		if (pa <= pb && pa <= pc)  return a;
		else if (pb <= pc)  return b;
		return c;
	}
	