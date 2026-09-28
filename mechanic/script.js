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

const form=document.getElementById('service-form');
if(form){
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const d=new FormData(form);
    const subject='Leonard Automotive service request - '+d.get('year')+' '+d.get('model');
    const body=[
      'Leonard Automotive service request',
      '',
      'Name: '+d.get('name'),
      'Phone: '+d.get('phone'),
      'Vehicle: '+d.get('year')+' '+d.get('model'),
      'Mileage: '+(d.get('mileage')||'Not provided'),
      'Service: '+d.get('service'),
      'Location: '+d.get('location'),
      '',
      'Notes:',
      d.get('notes')||'None'
    ].join('\n');
    const url='mailto:joshua.ray.leonard2007@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    window.location.href=url;
    const status=document.getElementById('form-status');
    if(status) status.textContent='Your email app should open with the request filled in.';
  });
}