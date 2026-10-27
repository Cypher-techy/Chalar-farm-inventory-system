/**
 * Builds web-ready Chalar Farms logo assets from the supplied artwork
 * (public/brand/chalar-logo-source.png, rust crescent + glowing leaf on near-black).
 *   chalar-mark.png       transparent, halo trimmed — compact header/sidebar mark (dark surfaces)
 *   chalar-mark-glow.png  transparent, full halo — large hero/brand display (dark surfaces)
 *   chalar-mark-tile.png  original dark background — favicon / light surfaces
 * Run: node scripts/build-brand-assets.cjs
 */
const sharp=require('sharp');
sharp.cache(false);
const src='public/brand/chalar-logo-source.png';
const BG=10;
const ss=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
async function build({S, cx, cy, out, mode}) {
  // place source on a padded near-black canvas so the crop never runs off the image
  const pad=200;
  const canvasPng=await sharp({create:{width:640+pad*2,height:641+pad*2,channels:3,background:{r:BG,g:BG,b:BG}}})
    .composite([{input:src,left:pad,top:pad}]).png().toBuffer();
  const {data:canvas,info}=await sharp(canvasPng).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const W=info.width, C=info.channels;
  const left=cx+pad-Math.round(S/2), top=cy+pad-Math.round(S/2);
  const outb=Buffer.alloc(S*S*4);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const i=((top+y)*W+(left+x))*C;
    let r=Math.max(0,canvas[i]-BG),g=Math.max(0,canvas[i+1]-BG),b=Math.max(0,canvas[i+2]-BG);
    const v=Math.max(r,g,b);
    const redDominant = r>g*1.25;
    let a;
    if(redDominant){
      // crescent is a flat rust (~95,39,26): make it fully opaque; the soft halo
      // around it is kept translucent (glow) or removed entirely (compact)
      a = mode==='compact' ? ss(60,80,v) : Math.max(v/245, ss(60,78,v));
    } else {
      // leaf + green glow: lift opacity so the leaf body reads solid
      a = Math.min(1, v/165);
    }
    // radial feather so no straight crop edge can ever show
    const dx=(x-S/2)/(S/2), dy=(y-S/2)/(S/2); const d=Math.sqrt(dx*dx+dy*dy);
    a*= 1-ss(mode==='glow'?0.78:0.9, 1.0, d);
    a=Math.min(1,Math.max(0,a));
    // colour = (source - background) / alpha + background, so compositing over a dark surface
    // reproduces the original artwork
    if(a>0.004){ r=Math.min(255,Math.round(r/a+BG)); g=Math.min(255,Math.round(g/a+BG)); b=Math.min(255,Math.round(b/a+BG)); }
    const o=(y*S+x)*4; outb[o]=r; outb[o+1]=g; outb[o+2]=b; outb[o+3]=Math.round(a*255);
  }
  await sharp(outb,{raw:{width:S,height:S,channels:4}}).resize(mode==='glow'?640:384,mode==='glow'?640:384).png({compressionLevel:9}).toFile(out);
}
(async()=>{
  await build({S:430,cx:297,cy:345,out:'public/brand/chalar-mark.png',mode:'compact'});
  await build({S:640,cx:297,cy:345,out:'public/brand/chalar-mark-glow.png',mode:'glow'});
  // favicon / apple touch icon (Next.js file conventions)
  await sharp('public/brand/chalar-logo-source.png').extract({left:57,top:105,width:480,height:480}).resize(512,512).png({compressionLevel:9}).toFile('public/brand/chalar-mark-tile.png');
  await sharp('public/brand/chalar-mark-tile.png').resize(256,256).png({compressionLevel:9}).toFile('src/app/icon.png');
  await sharp('public/brand/chalar-mark-tile.png').resize(180,180).png({compressionLevel:9}).toFile('src/app/apple-icon.png');
  console.log('done');
})();
