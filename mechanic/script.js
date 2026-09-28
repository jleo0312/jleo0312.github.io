const menuButton=document.querySelector('.menu-button');
const nav=document.querySelector('.site-nav');
if(menuButton&&nav){
  menuButton.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',String(open));
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
  }));
}
document.getElementById('year').textContent=new Date().getFullYear();
const form=document.getElementById('service-form');
const status=document.getElementById('form-status');
if(form&&status){
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const d=new FormData(form);
    const message=[
      '5VZ Mobile service request',
      '',
      'Name: '+d.get('name'),
      'Vehicle: '+d.get('vehicle'),
      'Mileage: '+(d.get('mileage')||'Not provided'),
      'Area: '+d.get('location'),
      '',
      'Requested work:',
      d.get('service')
    ].join('\n');
    try{
      await navigator.clipboard.writeText(message);
      status.textContent='Request copied to your clipboard. Paste it into a text or message to send.';
    }catch{
      status.textContent=message;
    }
  });
}