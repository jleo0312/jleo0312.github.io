/* Image validation and local HEIC conversion for portfolio uploads. */
(function(){
'use strict';
let converter;
function loadConverter(){
 if(typeof window.HeicTo==='function')return Promise.resolve(window.HeicTo);
 if(!converter)converter=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/editor/vendor/heic-to-1.6.5.js';script.async=true;
  script.onload=()=>typeof window.HeicTo==='function'?resolve(window.HeicTo):reject(new Error('The HEIC converter could not load. Try uploading again.'));
  script.onerror=()=>{script.remove();converter=null;reject(new Error('The HEIC converter could not load. Check your connection and try again.'));};
  document.head.append(script);
 });
 return converter;
}
async function validateImage(file){
 const src=URL.createObjectURL(file),image=new Image();
 try{image.src=src;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw new Error('Empty image');}
 catch{throw new Error('This image could not be displayed. Choose a JPG, PNG, WebP, GIF, SVG or HEIC photo.');}
 finally{URL.revokeObjectURL(src);}
}
async function prepare(file,{video=false,onStatus=()=>{}}={}){
 if(file.size>30*1024*1024)throw new Error('Choose a file smaller than 30 MB.');
 const heic=/\.hei[cf]$/i.test(file.name)||/^image\/(heic|heif)(?:-sequence)?$/i.test(file.type);
 if(video){
  if(!/^video\//.test(file.type)&&!/^image\/gif$/i.test(file.type)&&!(/\.(mp4|mov|webm|m4v|ogv|gif)$/i.test(file.name)&&!file.type))throw new Error('Choose a video or animated GIF for this preview.');
  return {file,converted:false};
 }
 if(file.type&&!/^image\//.test(file.type)&&!heic)throw new Error('Choose a photo for this image.');
 if(heic){
  onStatus('Converting HEIC photo to JPEG…');const convert=await loadConverter();let jpeg;
  try{jpeg=await convert({blob:file,type:'image/jpeg',quality:.92});}
  catch{throw new Error('This HEIC photo could not be converted. Export it as JPG or PNG and try again.');}
  const name=/\.hei[cf]$/i.test(file.name)?file.name.replace(/\.hei[cf]$/i,'.jpg'):file.name+'.jpg';
  file=new File([jpeg],name,{type:'image/jpeg',lastModified:file.lastModified});
 }
 if(file.size>30*1024*1024)throw new Error('The converted photo is larger than 30 MB. Choose a smaller photo.');
 await validateImage(file);return {file,converted:heic};
}
window.PortfolioMediaUpload={prepare};
})();
