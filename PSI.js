	
	
	
	
	function PSI ()
	{
	}
	
	PSI.Parse = function(buff, genv)
	{
		buff = new Uint8Array(buff);
		
		var str = PSI.B.readASCII(buff, 0, buff.length);
		var lines = str.split(/[\n\r]+/);
		
		var crds = null;
		var epsv = null;
		
		for(var li=0; li<lines.length; li++)
		{
			var line = lines[li].trim();
			if(line.charAt(0)=="%") {
				while(line.charAt(0)=="%") line = line.slice(1);
				var pts = line.split(":");
				if(pts[0]=="BoundingBox")  crds = pts[1].trim().split(/[ ]+/).map(parseFloat); 
				if(line.indexOf("!PS-Adobe-3.0 EPSF-3.0")!=-1) epsv=line;
			}
		}
		
		if(epsv==null || crds==null) crds = [0,0,595, 842];
		
		var os = [];	// operand stack
		var ds = PSI._getDictStack([],{});
		var es = [{  typ:"file", val: {  buff:buff, off:0  }  }];	// execution stack
		var gs = [];
		var env = PSI._getEnv(crds);
		var time = Date.now();
		var repeat = true;
		while(repeat) repeat = PSI.step(os, ds, es, gs, env, genv);
		
		
		//PSI.interpret(file, os, ds, es, [], gst, genv);
		console.log(Date.now()-time);
	}
	PSI._getDictStack = function(adefs, aprcs) {
		var defs = [
			"def","begin","end","currentfile","currentdict","known","version","currentpacking","setpacking","currentglobal","setglobal",
			"currentflat",
			"currentlinewidth","currentpoint","currentscreen","setscreen",
			"dict","string","readstring","readhexstring","readline","getinterval","putinterval","token",
			"array","aload","astore","length","matrix","mark","counttomark",
			"makefont","scalefont","stringwidth",
			
			"setfont", "setgray", "setrgbcolor","sethsbcolor", "setlinewidth", "setstrokeadjust","setflat","setlinecap","setlinejoin","setmiterlimit","setdash",
			"clip","eoclip","clippath","pathbbox",
			"newpath", "stroke", "fill", "eofill", "closepath","showpage","print",
			"moveto", "lineto", "curveto", "arc","arcn", "show","ashow","widthshow",
			"rmoveto","rlineto","rcurveto",
			"translate","rotate","scale","concat","concatmatrix","currentmatrix","setmatrix",
			
			"save","restore","gsave", "grestore",
			"usertime","readtime",
			"save", "restore","flush","readonly",
			
			"findresource","defineresource","image","colorimage",
			
			"xcheck",
			
			"if","ifelse","exec","stopped","dup","exch","copy","roll","index","pop","put","get","load","where","store","repeat","for","forall","loop","exit",
			"bind",
			"cvi","cvr","cvs","cvx",
			"add","sub","mul","div","idiv","bitshift","mod","exp","atan",
			"neg","abs","round","truncate","sqrt","ln","sin","cos",
			"srand","rand","==","transform","itransform","dtransform",
			"eq","ge","gt","le","lt","ne",
			"and","or","not",
			"filter",
			
			"begincmap","endcmap", "begincodespacerange","endcodespacerange", "beginbfrange","endbfrange","beginbfchar","endbfchar"
		].concat(adefs);
		
		var withCtx = ["image", "colorimage", "repeat", "for","forall","loop"];
		for(var i=0; i<withCtx.length; i++) defs.push(withCtx[i]+"---");
		
		var prcs = { 
			"findfont"    : "/Font findresource",
			"definefont"  : "/Font defineresource",
			"undefinefont": "/Font undefineresource"
		};
		prcs = PSI.makeProcs(prcs);
		for(var p in aprcs) prcs[p] = aprcs[p];
		
		var systemdict = {}, globaldict = {}, userdict = {}, statusdict = {};
		systemdict["systemdict"] = {typ:"dict", val:systemdict};
		systemdict["globaldict"] = {typ:"dict", val:globaldict};
		systemdict["userdict"  ] = {typ:"dict", val:userdict  };
		systemdict["statusdict"] = {typ:"dict", val:statusdict};
		systemdict["null"] = {typ:"null", val:null};
		
		for(var i=0; i<defs.length; i++) systemdict[defs[i]] = {  typ:"operator", val:defs[i]  };
		for(var p in prcs)               systemdict[p] = prcs[p];
		
		return [ systemdict,	globaldict, userdict ];  // dictionary stack
	}
	PSI._getEnv   = function(crds) {
		return {
			bb:crds,
			gst : PSI._getState(crds),
			pckn:false, amodeGlobal:false,
			cmnum:0, fnt:null,
			res:{},
			pgOpen:false
		}
	}
	PSI._getState = function(crds) {
		return {
			font : PSI._getFont(),
			dd: {flat:1},  // device-dependent
			space :"/DeviceGray",
			// fill
			ca: 1,
			colr  : [0,0,0],
			sspace:"/DeviceGray",
			// stroke
			CA: 1,
			COLR : [0,0,0],
			bmode: "/Normal",
			SA:false, OPM:0, AIS:false, OP:false, op:false, SMask:"/None",
			lwidth : 1,
			lcap: 0,
			ljoin: 0,
			mlimit: 10,
			SM : 0.1,
			doff: 0,
			dash: [],
			strokeAdj : false,
			ctm : [1,0,0,1,0,0],
			cpos: [0,0],
			pth : {cmds:[],crds:[]}, 
			cpth: {cmds:["M","L","L","L","Z"],crds:[crds[0],crds[1],crds[2],crds[1], crds[2],crds[3],crds[0],crds[3]]},  // clipping path
		};
	}
	PSI._getFont = function() {
		return {
			Tc: 0, // character spacing
			Tw: 0, // word spacing
			Th:100, // horizontal scale
			Tl: 0, // leading
			Tf:"Helvetica-Bold", 
			Tfs:1, // font size
			Tmode:0, // rendering mode
			Trise:0, // rise
			Tk: 0,  // knockout
			
			Tm :[1,0,0,1,0,0],
			Tlm:[1,0,0,1,0,0],
			Trm:[1,0,0,1,0,0]
		};
	}
	
	PSI.makeProcs = function(prcs) {
		var out = {};
		for(var p in prcs) {
			var pts = prcs[p].replace(/  +/g, " ").split(" ");
			out[p] = {typ:"procedure", val:[]};
			for(var i=0; i<pts.length; i++) out[p].val.push({typ:"name",val:pts[i]});
		}
		return out;
	}
	
	PSI.addProc = function(obj, es) {  
		if(obj.val.length==0) return;
		if(obj.off!=null && obj.off!=obj.val.length)   es.push({typ:"procedure", val:obj.val, off:0}); 
		else {  obj.off=0;  es.push( obj );  }
	}
	
	PSI._f32 = new Float32Array(1);
	PSI.step = function(os, ds, es, gs, env, genv, Oprs) 
	{
		var otime = Date.now(), f32 = PSI._f32;
		var getToken = PSI.getToken;
		
		var gst = env.gst;
		
		var tok = getToken(es, ds);  if(tok==null) return false;
		var typ = tok.typ, val = tok.val;
		
		if(!env.pgOpen) {  genv.StartPage(env.bb[0], env.bb[1], env.bb[2], env.bb[3]);  env.pgOpen = true;   }
		
		//console.log(tok, os.slice(0));
		/*ocnt++;
		//if(ocnt>2*lcnt) {  lcnt=ocnt;  console.log(ocnt, os.length, file.stk.length);  };
		if(ocnt>8000000) {  
			for(var key in opoc) if(opoc[key][1]<1000) delete opoc[key];
			console.log(Date.now()-otime, opoc);  throw "e";  
		} */
		
		if(typ=="integer" || typ=="real" || typ=="boolean" || typ=="string" || typ=="array" || typ=="procedure" || typ=="null") {  os.push(tok);  return true;  }
	
		if(typ!="name" && typ!="operator") throw "e";
		
		//if(opoc[val]==null) opoc[val]=[0,0];  opoc[val][0]++;  opoc[val][1]=ocnt;
			
		if(val.charAt(0)=="/") {
			if(val.charAt(1)=="/") throw "e";
			else os.push(tok);
		}
		else if(val=="{") {
			var ars = [], car = {typ:"procedure", val:[] };
			
			var ltok=getToken(es,ds); 
			while(true) {  
				if     (ltok.val=="{") {  var ncr = {typ:"procedure", val:[]};  car.val.push(ncr);  ars.push(car);  car=ncr;  }
				else if(ltok.val=="}") {  if(ars.length==0) break;  car = ars.pop();  }		
				else car.val.push(ltok);
				ltok=getToken(es,ds);  
			}
			os.push( car );
		}
		else if(val=="[" || val=="<<") os.push( {typ:"mark"} );
		else if(val=="]" || val==">>") {
			var arr = [];  while(os.length!=0) {  var o=os.pop();  if(o.typ=="mark") break;  arr.push(o);  }
			arr.reverse(); 
			if(val=="]") os.push( {typ:"array", val:arr } ); 
			else { 
				var ndct = {};  for(var i=0; i<arr.length; i+=2) ndct[arr[i].val.slice(1)] = arr[i+1];
				os.push( {typ:"dict", val:ndct } ); 
			}
		}
		else {
			var obj = PSI.getFromStacks(val, ds);
			
			//if(val=="rl^") {  console.log(val, os.slice(0));    }
			if(obj==null) {  console.log("unknown operator", val, os, ds);  throw "e";  }
			else if(obj.typ=="procedure") PSI.addProc(obj, es); //{  obj.off=0;  es.push(obj);  }
			/*
			else if(op.typ=="string") {
				var prc=[], sdta = {buff:op.val, off:0, stk:[]}, tk = getToken(sdta);  while(tk!=null) {  prc.push(tk);  tk=getToken(sdta);  }
				PSI.addProcedure(prc, file);
			}*/
			else if(["array","string","dict","null","integer","real","boolean","state","font","name"].indexOf(obj.typ)!=-1) os.push(obj);
			else if(obj.typ=="operator")
			{
				var op = obj.val;
				//if(omap[op]) op = omap[op];
				
				if(op=="def") {  var nv = os.pop(), nn = os.pop();  nn=nn.val.slice(1);  ds[ds.length-1][nn] = nv;  }
				else if(op=="dict"   ) {  os.pop().val;  os.push({typ:"dict"  , val:{} });  }
				else if(op=="string" ) {  var l=os.pop().val;  os.push({typ:"string", val:new Array(l) });  }
				else if(op=="readstring" || op=="readhexstring") {
					var str = os.pop(), l=str.val.length, fl = os.pop().val;  //console.log(op, str);  throw "e";
					if(op=="readstring") {  for(var i=0; i<l; i++) str.val[i]=fl.buff[fl.off+i];   fl.off+=l;  }
					else {
						var nv = PSI.readHex(fl, l);
						for(var i=0; i<nv.length; i++) str.val[i]=nv[i];
					}
					os.push(str, {typ:"boolean",val:true});
				}
				else if(op=="readline") {
					var str = os.pop(), fl = os.pop().val, i=0;
					if(PSI.isEOL(fl.buff[fl.off])) fl.off++;
					while(true)  {
						var cc = fl.buff[fl.off];  fl.off++;
						if(PSI.isEOL(cc)) break;
						str.val[i]=cc;   i++;
					}
					if(i<str.val.length && str.val[i]!=null) str.val[i]=null;
					os.push(str, {typ:"boolean",val:true});
				}
				else if(op=="getinterval") {
					var cnt = os.pop().val, idx = os.pop().val, src = os.pop(), out=[];
					if(src.typ=="string") for(var i=0; i<cnt; i++) out.push(src.val[idx+i]);
					else throw "e";
					//console.log(idx,cnt,out.slice(0));
					os.push({typ:src.typ, val:out});
				}
				else if(op=="putinterval") {
					var src=os.pop(), idx=os.pop().val, tgt=os.pop();
					if(idx+src.val.length>=tgt.val.length) throw "e";
					if(src.typ=="string") for(var i=0; i<src.val.length; i++) tgt.val[idx+i] = src.val[i];
					else throw "e";
					//console.log(src.val, tgt.val, idx);  throw "e";
				}
				else if(op=="token") {
					var src = os.pop();  if(src.typ!="string") throw "e";
					var arr = [];
					for(var i=0; i<src.val.length; i++) {  var bv=src.val[i];  if(bv==null) break;  arr.push(bv);  }
					var nfl = {  buff:new Uint8Array(arr), off:0   }, tok = getToken([{typ:"file",val:nfl}], ds);
					var ns = [];  for(var i=nfl.off; i<arr.length; i++) ns.push(arr[i]);
					os.push({typ:"string",val:ns}, tok, {typ:"boolean",val:true});
				}
				else if(op=="array"  ) {  var l=os.pop().val;  os.push({typ:"array" , val:new Array(l) });  }
				else if(op=="aload"){
					var o = os.pop(), arr = o.val;
					for(var i=0; i<arr.length; i++) os.push(arr[i]);
					os.push(o);
				}
				else if(op=="astore") {
					var o=os.pop(), arr = o.val;  //console.log(arr.length);  throw "e";
					for(var i=0; i<arr.length; i++) arr[arr.length-1-i]=os.pop();
					os.push(o);
				}
				else if(op=="length" ) {
					var o = os.pop(), typ=o.typ, l=0;
					if(typ=="array") l = o.val.length;
					else if(typ=="procedure") l = o.val.length;
					else {  console.log(o);  throw "e";  }
					os.push({typ:"integer",val:l});
				}
				else if(op=="matrix" ) {  os.push({typ:"array", val:PSI.makeArr([1,0,0,1,0,0],"real") });  }
				else if(op=="mark"   ) {  os.push({typ:"mark"});  }
				else if(op=="counttomark") {
					var i=os.length-1;  while(i!=-1 && os[i].typ!="mark") i--;
					os.push({typ:"integer",val:os.length-1-i});
				}
				else if(op=="begin") {  var o = os.pop(), dct=o.val;   if(dct==null || o.typ!="dict") {  console.log(o, ds);  throw "e";  }  ds.push(dct);  }
				else if(op=="end"  ) {  ds.pop();  }
				else if(op=="currentfile") {  var file;  for(var i=es.length-1; i>=0; i--) if(es[i].typ=="file")file=es[i];  os.push(file);  }
				else if(op=="currentdict") {  var dct=ds[ds.length-1];  os.push({typ:"dict", val:dct});  }
				else if(op=="known") {  var key=os.pop().val.slice(1), dct=os.pop().val;  os.push({typ:"boolean",val:dct[key]!=null});  }
				else if(op=="version") {  os.push({typ:"string", val:[51]});  } // "3"
				else if(op=="currentpacking") {  os.push({typ:"boolean",val:env.pckn});  }
				else if(op=="setpacking"    ) {  env.pckn = os.pop().val;  }
				else if(op=="currentglobal" ) {  os.push({typ:"boolean",val:env.amodeGlobal});  }
				else if(op=="setglobal"     ) {  env.amodeGlobal = os.pop().val;  }
				else if(op=="currentflat"   ) {  os.push({typ:"real",val:1});  }
				else if(op=="currentlinewidth") {  os.push({typ:"real",val:gst.lwidth});  }
				else if(op=="currentpoint"   ) {  var im=gst.ctm.slice(0);  PSI.M.invert(im);  var p=PSI.M.multPoint(im,gst.cpos);  
								os.push({typ:"real",val:p[0]}, {typ:"real",val:p[1]});  }
				else if(op=="currentscreen"  ) {  os.push({typ:"int",val:60}, {typ:"real",val:0},{typ:"real",val:0});  }
				else if(op=="setscreen"      ) {  os.pop();  os.pop();  os.pop();  }
				else if(op=="findresource")
				{
					var cat = os.pop().val.slice(1), key = os.pop().val.slice(1);
					if     (cat=="Font") {  rs = {typ:"font",val:PSI._getFont()};  rs.val.Tf=key;  }
					else if(cat=="ProcSet") rs = {typ:"dict",val:{}};
					else throw("Unknown resource category: "+cat);
					os.push(rs);
				}
				else if(op=="defineresource") {
					var cat = os.pop().val.slice(1), ins = os.pop().val, key = os.pop().val.slice(1);
					if(env.res[cat]==null) env.res[cat]={};
					env.res[cat][key]=ins;
				}
				else if(op=="image" || op=="colorimage") {
					var ncomp = 1, multi = false;
					if(op=="colorimage") {  ncomp = os.pop().val;  multi = os.pop().val;  }
					var src0, src1, src2;  
					if(multi) {  src2=os.pop();  src1=os.pop();  src0=os.pop();  }  else src0 = os.pop();
					var mat = PSI.readArr(os.pop().val), bpc = os.pop().val, h = os.pop().val, w = os.pop().val;
					
					if(ncomp!=3) throw "unsupported number of channels "+ncomp;
					if(bpc!=8) throw "unsupported bits per channel: "+bpc;
					
					var img = new Uint8Array(w*h*4);  for(var i=0; i<img.length; i++) img[i]=255;
					
					es.push({typ:"name",val:op+"---",ctx:[w,h,bpc,mat, ncomp,multi,img,0, src0,src1,src2]});
					PSI.addProc(src0, es);  
					if(multi) {  PSI.addProc(src1, es);  PSI.addProc(src2, es);  }
					//console.log(w,h,bpc,mat, src0,src1,src2, multi, ncomp);  throw "e";
				}
				else if(op=="image---" || op=="colorimage---") {
					var prm = tok.ctx, w=prm[0], h=prm[1], bpc=prm[2], mat=prm[3], ncomp=prm[4], multi=prm[5], img=prm[6], pind=prm[7];
					var src0 = prm[8], src1 = prm[9], src2=prm[10], dlen = 0;
					if(multi)
						for(i=0; i<3; i++){  var row = os.pop().val;  dlen = row.length;
							for(var j=0; j<dlen; j++) img[(pind+j)*4 + 2-i] = row[j];
						}
					else  {
						var row = os.pop().val;  dlen = Math.floor(row.length/3);
						if(row[0]==null) {  console.log(ds);  throw "e";  }
						for(var j=0; j<dlen; j++) {  var tj=j*3, qj=(pind+j)*4;  img[qj+0]=row[tj+0];  img[qj+1]=row[tj+1];  img[qj+2]=row[tj+2];  }
					}
					pind += dlen;
					if(pind==w*h) genv.PutImage(gst, img, w, h);
					else {  prm[7]=pind;  es.push(tok); 
						PSI.addProc(src0, es);  
						if(multi) {  PSI.addProc(src1, es);  PSI.addProc(src2, es);  }
					}
				}
				else if(op=="makefont") {
					var mt = PSI.readArr(os.pop().val), fnt = JSON.parse(JSON.stringify(os.pop()));
					PSI.M.concat(fnt.val.Tm, mt);  os.push(fnt);
				}
				else if(op=="scalefont") {
					var sc = os.pop().val, fnt = os.pop();  //console.log(ds);
					fnt.val.Tfs *= sc;  os.push(fnt);
				}
				else if(op=="stringwidth") {
					var str=os.pop().val;
					var sc = PSI.M.getScale(gst.font.Tm) / PSI.M.getScale(gst.ctm);
					//console.log(PSI.getString(str), gst.font, 0.6*sc*str.length);
					os.push({typ:"real",val:0.6*sc*str.length}, {typ:"real",val:sc});
				}
				else if(op=="setfont"     ) gst.font = os.pop().val;
				else if(op=="setlinewidth") gst.lwidth = os.pop().val;
				else if(op=="setstrokeadjust") gst.strokeAdj = os.pop().val;
				else if(op=="setlinecap") gst.lcap = os.pop().val;
				else if(op=="setlinejoin") gst.ljoin = os.pop().val;
				else if(op=="setmiterlimit") gst.mlimit = os.pop().val;
				else if(op=="setflat") gst.dd.flat=os.pop();
				else if(op=="setdash"     ) {  gst.doff=os.pop().val;  gst.dash = PSI.readArr(os.pop().val);  }
				else if(op=="show"||op=="ashow"||op=="widthshow") {  
					var sar = os.pop().val, str=PSI.readStr(sar);
					if(op=="widthshow") {  os.pop();  os.pop();  os.pop();  }
					if(op=="ashow"    ) {  os.pop();  os.pop();  }
					var om = gst.ctm;  gst.ctm = om.slice(0);  gst.ctm[4]=gst.cpos[0];  gst.ctm[5]=gst.cpos[1];//PSI.M.translate(gst.ctm,gst.cpos[0],gst.cpos[1]);
					genv.PutText(gst, str);  gst.cpos[0] += str.length*PSI.M.getScale(om)*gst.font.Tfs*0.55;  //console.log(str, gst.font.Tfs);
					gst.ctm = om;
				}
				else if(op=="setgray"    ) {  var g=PSI.nrm(os.pop().val);  gst.colr = gst.COLR = [g,g,g];  }
				else if(op=="setrgbcolor") {  var b=os.pop().val,g=os.pop().val,r=os.pop().val;  gst.colr = gst.COLR = [PSI.nrm(r),PSI.nrm(g),PSI.nrm(b)];  }
				else if(op=="sethsbcolor") {
					var v=os.pop().val,s=os.pop().val,h=os.pop().val;
					var r, g, b, i, f, p, q, t;
					i = Math.floor(h * 6);
					f = h * 6 - i;
					p = v * (1 - s);
					q = v * (1 - f * s);
					t = v * (1 - (1 - f) * s);
					switch (i % 6) {
						case 0: r = v, g = t, b = p; break;
						case 1: r = q, g = v, b = p; break;
						case 2: r = p, g = v, b = t; break;
						case 3: r = p, g = q, b = v; break;
						case 4: r = t, g = p, b = v; break;
						case 5: r = v, g = p, b = q; break;
					}
					gst.colr = gst.COLR = [PSI.nrm(r),PSI.nrm(g),PSI.nrm(b)];
				}
				else if(op=="clip" || op=="eoclip") {  gst.cpth = JSON.parse(JSON.stringify(gst.pth ));  }
				else if(op=="clippath" ) {  gst.pth  = JSON.parse(JSON.stringify(gst.cpth));  }
				else if(op=="pathbbox" ) {
					var ps = gst.pth.crds;
					var bb = PSI.G.getBB(ps);
					ps = [bb[0],bb[1], bb[2],bb[1],   bb[0],bb[3], bb[2],bb[3]];
					var im = gst.ctm.slice(0);  PSI.M.invert(im);  PSI.M.multArray(im,ps);
					bb = PSI.G.getBB(ps);
					f32[0]=bb[0];  bb[0]=f32[0];  f32[0]=bb[1];  bb[1]=f32[0];  f32[0]=bb[2];  bb[2]=f32[0];  f32[0]=bb[3];  bb[3]=f32[0];
					bb = PSI.makeArr(bb,"real");
					os.push(bb[0],bb[1],bb[2],bb[3]);
				}
				else if(op=="newpath"  ) PSI.G.newPath(gst);
				else if(op=="stroke"              ) {  genv.Stroke(gst);  PSI.G.newPath(gst);  }
				else if(op=="fill" || op=="eofill") {  genv.Fill(gst, op=="eofill");    PSI.G.newPath(gst);  }
				else if(op=="closepath") PSI.G.closePath(gst);
				else if(op=="showpage" ) {  genv.ShowPage ();  var ofnt=gst.font;  gst = env.gst = PSI._getState(env.bb);  gst.font=ofnt;  env.pgOpen = false;  }
				else if(op=="print"    ) {  var sar = os.pop().val, str=PSI.readStr(sar);  genv.Print(str);  }
				else if(op=="moveto"  || op=="lineto" ) {
					var y = os.pop().val, x = os.pop().val;
					if(op=="moveto" ) PSI.G.moveTo(gst,x,y);  else PSI.G.lineTo(gst,x,y);
				}
				else if(op=="rmoveto" || op=="rlineto") {
					var y = os.pop().val, x = os.pop().val;
					var im=gst.ctm.slice(0);  PSI.M.invert(im);  var p = PSI.M.multPoint(im, gst.cpos);
					y+=p[1];  x+=p[0];
					if(op=="rmoveto") PSI.G.moveTo(gst,x,y);  else PSI.G.lineTo(gst,x,y);
				}
				else if(op=="curveto") {
					var y3=os.pop().val, x3=os.pop().val, y2=os.pop().val, x2=os.pop().val, y1=os.pop().val, x1=os.pop().val;
					PSI.G.curveTo(gst,x1,y1,x2,y2,x3,y3);
				}
				else if(op=="arc" || op=="arcn") {
					var a2 = os.pop().val, a1 = os.pop().val, r = os.pop().val, y = os.pop().val, x = os.pop().val;
					//if(op=="arcn") a2=-a2;
					PSI.G.arc(gst,x,y,r,a1*Math.PI/180,a2*Math.PI/180, op=="arcn");
				}
				
				else if(["translate","scale","rotate","concat"].indexOf(op)!=-1) {
					var v = os.pop(), m, x, y;
					if(v.typ=="array") {  m = PSI.readArr(v.val);  y = os.pop().val;  }
					else  {  m = [1,0,0,1,0,0];  y = v.val;  }
					
					if(op=="translate" || op=="scale") x = os.pop().val;
					
					if(op=="translate") PSI.M.translate(m,x,y);
					if(op=="scale"    ) PSI.M.scale    (m,x,y);
					if(op=="rotate"   ) PSI.M.rotate   (m,-y*Math.PI/180);
					if(op=="concat"   ) PSI.M.concat   (m,y);
					
					if(v.typ=="array") os.push({typ:"array",val:PSI.makeArr(m,"real")});
					else {  PSI.M.concat(m,gst.ctm);  gst.ctm = m;  }
				}
				else if(op=="concatmatrix") { var rA = PSI.readArr;
					var m3 = rA(os.pop().val), m2 = rA(os.pop().val), m1 = rA(os.pop().val);
					var m = m1.slice(0);  PSI.M.concat(m, m2);  m = PSI.makeArr(m, "real");
					os.push({typ:"array",val:m});
				}
				else if(op=="currentmatrix") {
					var m = os.pop(), cm = PSI.makeArr(gst.ctm,"real");  // console.log(m, cm);  throw "e";
					for(var i=0; i<6; i++) m.val[i]=cm[i];   os.push(m);
				}
				else if(op=="setmatrix") {
					gst.ctm = PSI.readArr(os.pop().val);
				}
				else if(op=="cvi") {
					var o = os.pop(), v=o.val, out = 0;
					if     (o.typ=="real"   ) out = Math.round(v);
					else if(o.typ=="integer") out = v;
					else throw "unknown type "+o.typ;
					os.push({typ:"integer",val:out});
				}
				else if(op=="cvr") {
					var o = os.pop(), v=o.val, out = 0;
					if     (o.typ=="real"   ) out = v;
					else if(o.typ=="integer") out = v;
					else if(o.typ=="string" ) out = parseFloat(PSI.readStr(v));
					else throw "unknown type "+o.typ;
					os.push({typ:"real",val:out});
				}
				else if(op=="cvs") {
					var str = os.pop(), any = os.pop(), nv = "";  str.val=[];  os.push(str);
					if(any.typ=="real" || any.typ=="integer") {
						if(Math.abs(Math.round(any.val)-any.val)<1e-6) nv=Math.round(any.val)+".0";
						else nv = (Math.round(any.val*1000000)/1000000).toString();
					}
					else throw "unknown var type: "+any.typ;
					for(var i=0; i<nv.length; i++) str.val[i]=nv.charCodeAt(i);
				}
				else if(op=="cvx") {
					var o = os.pop();
					//if(o.typ=="array") o.typ="procedure";
					//else if(o.typ=="name" && o.val.charAt(0)=="/") o = {typ:"name",val:o.val.slice(1)};
					//else {  console.log(o);  throw "e";  }
					os.push(o);
				}
				else if(["add","sub","mul","div","idiv","bitshift","mod","exp","atan"].indexOf(op)!=-1) {
					var o1 = os.pop(), o0 = os.pop(), v0=o0.val, v1=o1.val, out = 0, otp = "";
					if(op=="add" || op=="sub" || op=="mul") otp = (o0.typ=="real" || o1.typ=="real") ? "real" : "integer";
					else if(op=="div" || op=="atan" || op=="exp") otp = "real";
					else if(op=="mod" || op=="idiv" || op=="bitshift") otp = "integer";
					
					if(o0.typ=="real") {  f32[0]=v0;  v0=f32[0];  }
					if(o1.typ=="real") {  f32[0]=v1;  v1=f32[0];  }
					
					if(op=="add") out = v0+v1;
					if(op=="sub") out = v0-v1;
					if(op=="mul") out = v0*v1;
					if(op=="div") out = v0/v1;
					if(op=="idiv")out = ~~(v0/v1);
					if(op=="bitshift") out = v1>0 ? (v0<<v1) : (v0>>>(-v1));
					if(op=="mod") out = v0%v1;
					if(op=="exp") out = Math.pow(v0, v1);
					if(op=="atan")out = Math.atan2(v0, v1)*180/Math.PI;
					
					if(otp=="real") {  f32[0]=out;  out=f32[0];  }
					os.push({ typ:otp, val:out });
				}
				else if(["neg","abs","round","truncate","sqrt","ln","sin","cos"].indexOf(op)!=-1) {
					var o0 = os.pop(), v0=o0.val, out = 0, otp = "";
					if(op=="neg" || op=="abs" || op=="truncate") otp=o0.typ;
					else if(op=="round") otp="integer";
					else if(op=="sqrt" || op=="sin" || op=="cos" || op=="ln") otp="real";
					
					if(o0.typ=="real") {  f32[0]=v0;  v0=f32[0];  }
					
					if(op=="neg" ) out = -v0;
					if(op=="abs" ) out = Math.abs(v0);
					if(op=="round")out = Math.round(v0);
					if(op=="truncate") out = Math.trunc(v0);
					if(op=="sqrt") out = Math.sqrt(v0);
					if(op=="ln"  ) out = Math.log(v0);
					if(op=="sin" ) out = Math.sin(v0*Math.PI/180);
					if(op=="cos" ) out = Math.cos(v0*Math.PI/180);
					
					if(op=="ln" && v0<=0)  throw "e";
					
					if(otp=="real") {  f32[0]=out;  out=f32[0];  }
					
					os.push({typ:otp, val:out});
				}
				else if(["eq","ge","gt","le","lt","ne"].indexOf(op)!=-1) {
					var o1=os.pop(), o0=os.pop(), v0=o0.val, v1=o1.val, out=false;
					if(op=="eq") out=v0==v1;
					if(op=="ge") out=v0>=v1;
					if(op=="gt") out=v0> v1;
					if(op=="le") out=v0<=v1;
					if(op=="lt") out=v0< v1;
					if(op=="ne") out=v0!=v1;
					os.push({typ:"boolean",val:out});
				}
				else if(["and","or"].indexOf(op)!=-1) {
					var b2 = os.pop(), b1 = os.pop(), v1=b1.val, v2 = b2.val, ints=(b1.typ=="integer"), out;
					if(op=="and") out = ints ? (v1&v2) : (v1&&v2);
					if(op=="or" ) out = ints ? (v1|v2) : (v1||v2);
					os.push({typ:ints?"integer":"boolean", val:out});
				}
				else if(op=="not") {
					var b=os.pop(), v=b.val, ints=b.typ=="integer";
					var out = ints ? (~v) : (!v);
					os.push({typ:ints?"integer":"boolean", val:out});
				}
				else if(op=="if") {
					var proc = os.pop(), cnd = os.pop().val;
					if(cnd) PSI.addProc(proc, es);//PSI.callProcedure(proc, file, os, ds, es, gs, gst, genv);
				}
				else if(op=="ifelse") {
					var proc2 = os.pop(), proc1 = os.pop(), cnd = os.pop().val;
					PSI.addProc(cnd?proc1:proc2, es);
				}
				else if(op=="exec" || op=="stopped") {  var obj = os.pop();  
					if(op=="stopped") os.push({typ:"boolean", val:false});
				
					if(obj.typ=="procedure") PSI.addProc(obj, es);  
					else if(obj.typ=="name") PSI.addProc({typ:"procedure",val:[obj]},es);
					else throw "unknown executable type: "+obj.typ;
				}
				else if(op=="dup" ) {  var v=os.pop();  os.push(v,v);  }
				else if(op=="exch") {  os.push(os.pop(), os.pop());  }
				else if(op=="copy") {
					var n = os.pop();  //console.log(n);
					if(n.typ=="integer") {  var els=[];  for(var i=0; i<n.val; i++) els[n.val-1-i] = os.pop();  
						for(var i=0; i<n.val; i++) os.push(els[i]);  
						for(var i=0; i<n.val; i++) os.push(els[i]);    }
					else if(n.typ=="array") {
						var m = os.pop().val;
						for(var i=0; i<m.length; i++) {  n.val[i]=m[i];  if(m[i].val==null) {  console.log(ds);  throw "e"; }  }
						os.push(n);
					}
					else throw "e";
				}
				else if(op=="roll") {  var j=os.pop().val, n = os.pop().val;
					var els = [];  for(var i=0; i<n; i++) els.push(os.pop());  els.reverse();
					j = (n+j)%n;
					for(var i=0; i<j; i++) els.unshift(els.pop());
					for(var i=0; i<n; i++) os.push(els[i]);
				}
				else if(op=="index") {  var n=os.pop().val;
					var els=[];  for(var i=0; i<=n; i++) els.push(os.pop());  els.reverse();
					for(var i=0; i<=n; i++) os.push(els[i]);   os.push(els[0]);
				}
				else if(op=="transform" || op=="itransform" || op=="dtransform") {
					var m = os.pop(), y=0, x=0;  //console.log(m);
					if(m.typ=="array") { m = PSI.readArr(m.val);  y = os.pop().val;  }
					else               { y = m.val;  m = gst.ctm.slice(0);  }
					if(op=="itransform") {  PSI.M.invert(m);  }
					x = os.pop().val;
					var np = PSI.M.multPoint(m, [x,y]);
					if(op=="dtransform") {  np[0]-=m[4];  np[1]-=m[5];  }
					os.push({typ:"real",val:np[0]},{typ:"real",val:np[1]});
				}
				else if(op=="pop" || op=="srand" || op=="==" ) {  os.pop();   }
				else if(op=="rand") {  os.push({typ:"integer",val:Math.floor(Math.random()*0x7fffffff)});  }
				else if(op=="put" ) {  
					var val=os.pop(), o=os.pop(), obj=os.pop(), otp=obj.typ;  //console.log(obj,o,val);  throw "e";
					if(otp=="array") obj.val[o.val] = val;
					else if(otp=="dict")  obj.val[o.val.slice(1)]=val;
					else throw "e";
					//.val.slice(1), obj=os.pop();  obj.val[key]=obj.typ=="string" ? val.val : val;  
				}
				else if(op=="get" ) {  
					var o=os.pop(), obj=os.pop(), otp=obj.typ; //  console.log(o, obj);
					if     (otp=="string") os.push({typ:"integer",val:obj.val[o.val]}); 
					else if(otp=="array" ) os.push(obj.val[o.val]);
					else throw "getting from unknown type "+  obj.typ;  //os.push(obj.val[key]);  
				}
				else if(op=="load") {  var key=os.pop().val.slice(1), val = PSI.getFromStacks(key, ds);  
					if(val==null) {  console.log(key, ds);  throw "e";  }  os.push(val);  }
				else if(op=="where"){  var key=os.pop().val.slice(1), dct=PSI.where(key,ds);   //console.log(dct);
					if(dct!=null) os.push({typ:"dict",val:dct});  os.push({typ:"boolean",val:dct!=null});  }
				else if(op=="store"){
					var val=os.pop(), key=os.pop().val.slice(1), dct=PSI.where(key,ds);   //console.log(dct, key);  throw "e";
					if(dct==null) dct=ds[ds.length-1];  dct[key]=val;  }
				else if(op=="repeat" ) {
					var proc=os.pop(), intg=os.pop().val;
					es.push({typ:"name",val:op+"---", ctx:{ proc:proc, cur:0, cnt:intg }});
				}
				else if(op=="repeat---") {
					var ctx = tok.ctx;
					if(ctx.cur<ctx.cnt) {  es.push(tok);  PSI.addProc(ctx.proc, es);  ctx.cur++;  }
				}
				else if(op=="for" ) {
					var proc=os.pop(), liV=os.pop(), icV=os.pop(), itV=os.pop();
					es.push({typ:"name",val:op+"---", ctx:{  proc:proc, isInt:(itV.typ=="integer" && icV.typ=="integer"), 
								init:itV.val, inc:icV.val, limit:liV.val  }});
				}
				else if(op=="for---") {
					var ctx = tok.ctx;
					if(ctx.isInt) {
						if((ctx.inc>0 && ctx.init<=ctx.limit) || (ctx.inc<0 && ctx.init>=ctx.limit)) {
							es.push(tok);  PSI.addProc(ctx.proc, es);  
							os.push({typ:"integer",val:ctx.init});  ctx.init+=ctx.inc;
						}
					}
					else {
						var lf = new Float32Array(1);
						lf[0]=ctx.limit;  ctx.limit=lf[0];
						lf[0]=ctx.inc  ;  ctx.inc  =lf[0];
						lf[0]=ctx.init;
						if((ctx.inc>0 && lf[0]<=ctx.limit)  ||  (ctx.inc<0 && lf[0]>=ctx.limit)) { 
							es.push(tok);  PSI.addProc(ctx.proc, es);  
							os.push({typ:"real",val:lf[0]});  lf[0]+=ctx.inc;  ctx.init=lf[0];
						}
					}
				}
				else if(op=="loop" ) {
					var proc=os.pop();
					es.push({typ:"name",val:op+"---", ctx:{ proc:proc }});
				}
				else if(op=="loop---") {
					var ctx = tok.ctx;
					PSI.addProc(ctx.proc, es);
				}
				else if(op=="forall") {
					var proc = os.pop(), obj = os.pop();
					es.push({typ:"name",val:op+"---",ctx:[proc,obj,0]});
				}
				else if(op=="forall---") {
					var ctx=tok.ctx, proc=ctx[0],obj=ctx[1],i=ctx[2];
					if(obj.typ=="dict") {
						throw "e";
						for(var p in obj.val) {  PSI.addProcedure(proc.val, file);  PSI.addProcedure([obj.val[p]], file);  }
					}
					else if(obj.typ=="procedure" || obj.typ=="array") {
						if(i<obj.val.length) {
							es.push(tok);  PSI.addProc(proc, es);  
							os.push(obj.val[i]);  ctx[2]++;
						}
						//for(var i=obj.val.length-1; i>=0; i--) {  PSI.addProcedure(proc.val, file);  PSI.addProcedure([obj.val[i]], file);  }
					}
					else {  console.log(proc, obj);  throw "forall: unknown type: "+obj.typ;  }
				}
				else if(op=="exit") {
					var i = es.length-1;
					while(es[i].typ!="name" || !es[i].val.endsWith("---")) i--;
					while(es.length>i) es.pop();
					//console.log(es,i);  throw "e";
				}
				else if(op=="bind") {  
				
					/* var v=os.pop(), prc=v.val;  os.push(v); 
					for(var i=0; i<prc.length; i++){
						var nop = PSI.getOperator(prc[i].val, ds);	 
						//if(nop!=null) prc[i]=nop;  // missing !!!
					}*/
				}
				else if(op=="xcheck") {
					var obj = os.pop(), typ=obj.typ;
					os.push({typ:"boolean",val:(typ=="procedure")});
					//console.log(obj);  throw "e";
				}
				else if(op=="save"    ) {  os.push({typ:"state",val:JSON.parse(JSON.stringify(gst))});   }
				else if(op=="restore" ) {  gst = env.gst = os.pop().val;  }
				else if(op=="gsave"   ) {  gs.push(JSON.parse(JSON.stringify(gst)));  }
				else if(op=="grestore") {  gst = env.gst = gs.pop();  }
				else if(op=="usertime" || op=="realtime") os.push({typ:"integer",val:(op=="usertime"?(Date.now()-otime):Date.now())});
				else if(op=="flush" || op=="readonly") {}
				else if(op=="filter") {
					var fname = os.pop().val.slice(1), sarr;
					if(fname=="ASCII85Decode") {
						var sfile = os.pop().val;   sarr = PSI.F.ASCII85Decode(sfile);
					}
					else if(fname=="RunLengthDecode") {
						var sfile = os.pop().val;   sarr = PSI.F.RunLengthDecode(sfile);
					}
					else throw fname;
					os.push({typ:"file", val:{buff:sarr, off:0, stk:[], env:{pckn:false}}});
				}
				else if(op=="begincmap" || op=="endcmap") {}
				else if(op=="begincodespacerange"||op=="beginbfrange"||op=="beginbfchar") {  env.cmnum = os.pop().val;  }
				else if(op=="endcodespacerange"  ||op=="endbfrange"  ||op=="endbfchar"  ) {
					var cl = (op=="endbfrange"?3:2);
					var pn = op.slice(3), dct = ds[ds.length-1], bpc=0;
					if(dct[pn]==null) dct[pn]=[];
					for(var i=0; i<env.cmnum; i++) {
						var vs=[];  
						for(var j=cl-1; j>=0; j--) {  
							var ar=os.pop(), av=ar.val, nv;
							if(ar.typ=="string") {  nv = PSI.strToInt(av);  if(j==0) bpc=av.length;  }
							else {  nv = [];  for(var k=0; k<av.length; k++) nv.push(PSI.strToInt(av[k].val));  }
							vs[j]=nv;
						}
						dct[pn] = dct[pn].concat(vs);
					}
					if(op!="endcodespacerange") dct["bpc"] = bpc; // bytes per input character
				}
				else if(Oprs) Oprs(op, os, ds, es, gs, env, genv);
				else {  console.log(val, op);  console.log(ds, os);  throw "e";  }
			}
		}
		return true;
	}
	PSI.strToInt = function(str)  {  var v=0;  for(var i=0; i<str.length; i++) v = (v<<8)|str[i];  return v;  }

	
	PSI.F = {
		ASCII85Decode : function(file) {
			var pws = [85*85*85*85, 85*85*85, 85*85, 85, 1];
			var arr = [], i=0, tc=0, off=file.off;
			while(true) {
				if(off>=file.buff.length)  throw "e";
				var cc = file.buff[off];  off++;
				if(PSI.isWhite(cc))  continue;
				if(cc==126) {
					if(i!=0) {
						if(i==3) {  arr.push(((tc>>>24)&255));                   }
						if(i==4) {  arr.push(((tc>>>24)&255), ((tc>>>16)&255));    }
						var lb = (5-i)<<3;  // i=2: 24, i=3: 16 ...
						var nn=((tc>>>lb)&255);  tc=(tc&((1<<lb)-1));  if(tc!=0)nn++;  arr.push(nn);
					}
					file.off=off+1;  //console.log(arr.join(","));  
					return new Uint8Array(arr);  
				}
				if(cc<33 || cc-33>84) throw "e";
				tc += (cc-33)*pws[i];  i++;
				if(i==5) {
					arr.push((tc>>>24)&255);  arr.push((tc>>>16)&255);
					arr.push((tc>>> 8)&255);  arr.push((tc>>> 0)&255);
					i=0;  tc=0;
				}
			}
		},
		RunLengthDecode : function(file) {
			var arr = [], off=file.off;
			while(true) {
				if(off>=file.buff.length)  {  console.log(arr);  throw "e";  }
				var cc = file.buff[off];  off++;
				if(cc==128) {  file.off=off;  return new Uint8Array(arr);  }
				if(cc< 128) {  for(var i=0; i<cc+1  ; i++) arr.push(file.buff[off+i]);  off+=cc+1;  }
				else        {  for(var i=0; i<257-cc; i++) arr.push(file.buff[off]  );  off++;      }
			}
		},
		FlateDecode : function(file) {
			var b = file.buff, ub = new Uint8Array(b.buffer,file.off,b.length);  //console.log(ub);
			var bytes = pako["inflate"](ub);
			return bytes;
		}
	}
	
	PSI.G = {
		concat : function(p,r) {
			for(var i=0; i<r.cmds.length; i++) p.cmds.push(r.cmds[i]);
			for(var i=0; i<r.crds.length; i++) p.crds.push(r.crds[i]);
		},
		getBB  : function(ps) {
			var x0=1e99, y0=1e99, x1=-x0, y1=-y0;
			for(var i=0; i<ps.length; i+=2) {  var x=ps[i],y=ps[i+1];  if(x<x0)x0=x; else if(x>x1)x1=x;  if(y<y0)y0=y;  else if(y>y1)y1=y;  }
			return [x0,y0,x1,y1];
		},
		newPath: function(gst    ) {  gst.pth = {cmds:[], crds:[]};  },
		moveTo : function(gst,x,y) {  var p=PSI.M.multPoint(gst.ctm,[x,y]);  //if(gst.cpos[0]==p[0] && gst.cpos[1]==p[1]) return;
										gst.pth.cmds.push("M");  gst.pth.crds.push(p[0],p[1]);  gst.cpos = p;  },
		lineTo : function(gst,x,y) {  var p=PSI.M.multPoint(gst.ctm,[x,y]);  if(gst.cpos[0]==p[0] && gst.cpos[1]==p[1]) return;
										gst.pth.cmds.push("L");  gst.pth.crds.push(p[0],p[1]);  gst.cpos = p;  },
		curveTo: function(gst,x1,y1,x2,y2,x3,y3) {   var p;  
			p=PSI.M.multPoint(gst.ctm,[x1,y1]);  x1=p[0];  y1=p[1];
			p=PSI.M.multPoint(gst.ctm,[x2,y2]);  x2=p[0];  y2=p[1];
			p=PSI.M.multPoint(gst.ctm,[x3,y3]);  x3=p[0];  y3=p[1];  gst.cpos = p;
			gst.pth.cmds.push("C");  
			gst.pth.crds.push(x1,y1,x2,y2,x3,y3);  
		},
		closePath: function(gst  ) {  gst.pth.cmds.push("Z");  },
		arc : function(gst,x,y,r,a0,a1, neg) {
			
			// circle from a0 counter-clock-wise to a1
			if(neg) while(a1>a0) a1-=2*Math.PI;
			else    while(a1<a0) a1+=2*Math.PI;
			var th = (a1-a0)/4;
			
			var x0 = Math.cos(th/2), y0 = -Math.sin(th/2);
			var x1 = (4-x0)/3, y1 = y0==0 ? y0 : (1-x0)*(3-x0)/(3*y0);
			var x2 = x1, y2 = -y1;
			var x3 = x0, y3 = -y0;
			
			var p0 = [x0,y0], p1 = [x1,y1], p2 = [x2,y2], p3 = [x3,y3];
			
			var pth = {cmds:[(gst.pth.cmds.length==0)?"M":"L","C","C","C","C"], crds:[x0,y0,x1,y1,x2,y2,x3,y3]};
			
			var rot = [1,0,0,1,0,0];  PSI.M.rotate(rot,-th);
			
			for(var i=0; i<3; i++) {
				p1 = PSI.M.multPoint(rot,p1);  p2 = PSI.M.multPoint(rot,p2);  p3 = PSI.M.multPoint(rot,p3);
				pth.crds.push(p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]);
			}
			
			var sc = [r,0,0,r,x,y];  
			PSI.M.rotate(rot, -a0+th/2);  PSI.M.concat(rot, sc);  PSI.M.multArray(rot, pth.crds);
			PSI.M.multArray(gst.ctm, pth.crds);
			
			PSI.G.concat(gst.pth, pth);
			var y=pth.crds.pop();  x=pth.crds.pop();
			gst.cpos = [x,y];
		}
	}
	PSI.M = {
		getScale : function(m) {  return Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]));  },
		translate: function(m,x,y) {  PSI.M.concat(m, [1,0,0,1,x,y]);  },
		rotate   : function(m,a  ) {  PSI.M.concat(m, [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a),0,0]);  },
		scale    : function(m,x,y) {  PSI.M.concat(m, [x,0,0,y,0,0]);  },
		concat   : function(m,w  ) {  
			var a=m[0],b=m[1],c=m[2],d=m[3],tx=m[4],ty=m[5];
			m[0] = (a *w[0])+(b *w[2]);       m[1] = (a *w[1])+(b *w[3]);
			m[2] = (c *w[0])+(d *w[2]);       m[3] = (c *w[1])+(d *w[3]);
			m[4] = (tx*w[0])+(ty*w[2])+w[4];  m[5] = (tx*w[1])+(ty*w[3])+w[5]; 
		},
		invert   : function(m    ) {  
			var a=m[0],b=m[1],c=m[2],d=m[3],tx=m[4],ty=m[5], adbc=a*d-b*c;
			m[0] = d/adbc;  m[1] = -b/adbc;  m[2] =-c/adbc;  m[3] =  a/adbc;
			m[4] = (c*ty - d*tx)/adbc;  m[5] = (b*tx - a*ty)/adbc;
		},
		multPoint: function(m, p ) {  var x=p[0],y=p[1];  return [x*m[0]+y*m[2]+m[4],   x*m[1]+y*m[3]+m[5]];  },
		multArray: function(m, a ) {  for(var i=0; i<a.length; i+=2) {  var x=a[i],y=a[i+1];  a[i]=x*m[0]+y*m[2]+m[4];  a[i+1]=x*m[1]+y*m[3]+m[5];  }  }
	}
	PSI.C = {
		srgbGamma : function(x) {  return x < 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1.0 / 2.4) - 0.055;  },
		cmykToRgb : function(c) {  var iK = 1-c[3];  return [(1-c[0])*iK, (1-c[1])*iK, (1-c[2])*iK];  },
		labToRgb  : function(lab) {
			var k = 903.3, e = 0.008856, L = lab[0], a = lab[1], b = lab[2];
			var fy = (L+16)/116, fy3 = fy*fy*fy;
			var fz = fy - b/200, fz3 = fz*fz*fz;
			var fx = a/500 + fy, fx3 = fx*fx*fx;
			var zr = fz3>e ? fz3 : (116*fz-16)/k;
			var yr = fy3>e ? fy3 : (116*fy-16)/k;
			var xr = fx3>e ? fx3 : (116*fx-16)/k;
				
			var X = xr*96.72, Y = yr*100, Z = zr*81.427, xyz = [X/100,Y/100,Z/100];
			var x2s = [3.1338561, -1.6168667, -0.4906146, -0.9787684,  1.9161415,  0.0334540, 0.0719453, -0.2289914,  1.4052427];
			
			var rgb = [ x2s[0]*xyz[0] + x2s[1]*xyz[1] + x2s[2]*xyz[2],
						x2s[3]*xyz[0] + x2s[4]*xyz[1] + x2s[5]*xyz[2],
						x2s[6]*xyz[0] + x2s[7]*xyz[1] + x2s[8]*xyz[2]  ];
			for(var i=0; i<3; i++) rgb[i] = Math.max(0, Math.min(1, PSI.C.srgbGamma(rgb[i])));
			return rgb;
		}
	}
	PSI.B = {
		readUshort : function(buff,p)  {  return (buff[p]<< 8) | buff[p+1];  },
		readUint   : function(buff,p)  {  return (buff[p]*(256*256*256)) + ((buff[p+1]<<16) | (buff[p+2]<< 8) | buff[p+3]);  },
		readASCII  : function(buff,p,l){  var s = "";  for(var i=0; i<l; i++) s += String.fromCharCode(buff[p+i]);  return s;    }
	}
	
	PSI.nrm = function(v) {  return Math.max(0,Math.min(1,v));  }
	PSI.makeArr = function(a,typ) {  var na=[];  for(var i=0; i<a.length; i++) na.push({typ:typ,val:a[i]});  return na;  }
	PSI.readArr = function(a    ) {  var na=[];  for(var i=0; i<a.length; i++) na.push(a[i].val          );  return na;  }
	PSI.readStr = function(a    ) {  var s ="";  for(var i=0; i<a.length; i++) s+=String.fromCharCode(a[i]); return s;   }

	PSI.getFromStacks = function(name, ds)
	{
		//console.log(ds);
		var di = ds.length-1;
		while(di>=0) {  if(ds[di][name]!=null) return ds[di][name];  di--;  }
		return null;
	}
	PSI.where = function(name, ds)
	{
		var di = ds.length-1;
		while(di>=0) {  if(ds[di][name]!=null) return ds[di]      ;  di--;  }
		return null;
	}
	
	
	
	
	
	
	
	PSI.skipWhite = function(file) {
		var i = file.off, buff=file.buff, isWhite = PSI.isWhite;
		
		while(isWhite(buff[i]) || buff[i]==37) {
			while(isWhite(buff[i])) i++;	// not the first whitespace
			if(buff[i]==37) {  while(i<buff.length && !PSI.isEOL(buff[i])) i++;  i++;  }	// comments
		}
		file.off = i;
	}
	
	
	
	PSI.getToken = function(es, ds) {
		var src = es[es.length-1];
		if(src.typ=="procedure") {
			var tok = src.val[src.off];  src.off++;
			if(src.off==src.val.length) es.pop();
			return tok;
		}
		if(src.typ=="name") {  es.pop();  return src;  }
		
		var ftok = PSI.getFToken(src.val, ds);
		if(ftok==null) {  es.pop();  if(es.length!=0) ftok = PSI.getFToken(es[es.length-1].val, ds);  }
		return ftok;
	}
	
	PSI.getFToken = function(file, ds) {
		PSI.skipWhite(file);
		
		var isWhite = PSI.isWhite, isSpecl = PSI.isSpecl;
		var i = file.off, buff=file.buff, tok = null;
		if(i>=buff.length) return null;
		
		var cc = buff[i], ch = String.fromCharCode(cc);  i++;
			
		if(ch=="(") {  
			var dpth=0, end=i;
			while(!(buff[end]==41 && dpth==0)) {  if(buff[end]==40) dpth++;  if(buff[end]==41) dpth--;  if(buff[end]==92) end++;   end++;  }
			var str = []; 
			for(var j=0; j<end-i; j++) str.push(buff[i+j]);
			i = end+1;
			str = PSI.getString(str);
			tok = {typ:"string", val:str};
		}
		else if(ch=="{" || ch=="}" || ch=="[" || ch=="]") {  tok = {typ:"name", val:ch};  }
		else if((ch=="<" && buff[i]==60) || (ch==">" && buff[i]==62)) {  tok = {typ:"name", val:ch=="<" ? "<<" : ">>"};  i++;  }
		else if(ch=="<") {
			var end = i;  while(buff[end]!=62) end++;  
			var str = PSI.readHex({buff:buff,off:i},(end-i)>>>1);
			tok = {typ:"string",val:str};  i = end+1;
		}
		else {
			var end = i;
			while(end<buff.length && !isWhite(buff[end]) && (!isSpecl(buff[end]) || (buff[end]==47&&buff[end-1]==47&&end==i) )) end++;  // read two slashes
			var name = PSI.B.readASCII(buff, i-1, end-i+1);
			i = end;
			var num = parseFloat(name);
			if(false) {}
			else if(name=="true" || name=="false") tok = {typ:"boolean", val:name=="true"};
			else if(!isNaN(num)) {
				var f32 = new Float32Array(1);  f32[0]=num;  num=f32[0];
				tok = {typ:name.indexOf(".")==-1?"integer":"real", val:num};
			}
			else {  
				if(name.slice(0,2)=="//") {
					var nn = name.slice(2);
					var sbs = PSI.getFromStacks(nn, ds);
					if(sbs==null) throw "e";
					tok = sbs;
				}
				else tok = {typ:"name", val:name};    
			}
		}
		file.off = i;
		
		return tok;
	}
	// ( ) < >     [ ] { }  %  /
	PSI.isSpecl = function(cc) {  return [ 40,41, 60,62,   91,93, 123,125,  37,  47   ].indexOf(cc)!=-1;  }
	PSI.isWhite = function(cc) {  return cc==9 || cc==10 || cc==12 || cc==13 || cc==32;  }
	PSI.isEOL   = function(cc) {  return cc==10 || cc==13;  }
	
	PSI.getString = function(str) {  
		var s=[];  
		var m0 = ["n" , "r" , "t" , "b" , "f" , "\\", "(", ")", " ", "/"];
		var m1 = ["\n", "\r", "\t", "", "", "\\", "(", ")", " ", "/"];
		
		for(var i=0; i<str.length; i++) {
			var cc = str[i], ch = String.fromCharCode(cc);
			if(ch=="\\") {
				var nx = String.fromCharCode(str[i+1]);  i++;
				if(nx=="\r" || nx=="\n") continue;
				var idx = m0.indexOf(nx);
				if(idx!=-1) s.push(m1[idx].charCodeAt(0));
				else {
					var cod = nx + String.fromCharCode(str[i+1]) + String.fromCharCode(str[i+2]);  i+=2;
					s.push(parseInt(cod,8));
				}
			}
			else s.push(cc);  
		}
		return s;  
	}
	PSI.makeString = function(arr) {
		var m0 = ["n" , "r" , "t" , "b" , "f" , "\\", "(", ")"];
		var m1 = ["\n", "\r", "\t", "", "", "\\", "(", ")"];
		var out = [];
		for(var i=0; i<arr.length; i++) {
			var b = arr[i];
			var mi = m1.indexOf(String.fromCharCode(b));
			if(mi==-1) out.push(b);
			else out.push(92, m0[mi].charCodeAt(0));
		}
		return out;
	}
	PSI.readHex = function(fl, l)
	{
		var i=0, j=-1, val=[];
		while(true) {
			var cc = fl.buff[fl.off];  fl.off++;
			var ci=0;
			if(47<cc && cc<58) ci=cc-48;
			else if(96<cc && cc<103) ci=10+cc-97;
			else if(64<cc && cc<71 ) ci=10+cc-65;
			else continue;
			if(j==-1) j=ci;
			else {  val[i]=(j<<4)|ci;  j=-1;  i++;  if(i==l) break;  }
		}
		return val;
	}
	
	