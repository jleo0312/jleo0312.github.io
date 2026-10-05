/* Shared media limits, image validation and local HEIC conversion. */
(function(){
'use strict';
let converter;
const MB=1024*1024;
function checkSize(file,video=false){
 const limit=video?100:30;
 if(file.size<=limit*MB)return;
 const size=(Math.ceil(file.size/MB*10)/10).toFixed(1);
 throw new Error(video?`This video / GIF is ${size} MB. GitHub supports files up to 100 MB. Compress or trim it to 100 MB or less, then try again. Your existing media is unchanged.`:`This photo is ${size} MB. Choose a photo of 30 MB or less. Your existing media is unchanged.`);
}
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
 checkSize(file,video);
 const heic=/\.hei[cf]$/i.test(file.name)||/^image\/(heic|heif)(?:-sequence)?$/i.test(file.type);
 if(video){
  if(!/^video\//.test(file.type)&&!/^image\/gif$/i.test(file.type)&&!(/\.(mp4|mov|webm|m4v|ogv|gif)$/i.test(file.name)&&!file.type))throw new Error('Choose a video or animated GIF.');
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
 checkSize(file);
 await validateImage(file);return {file,converted:heic};
}
window.PortfolioMediaUpload={prepare};
})();
