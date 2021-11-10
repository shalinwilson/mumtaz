- [1] Download posbox v 17.10
```
Download posbox image link: https://nightly.odoo.com/master/posbox/posbox_image_v17.zip
Install guide: https://odoo-development.readthedocs.io/en/latest/admin/posbox/install-posbox-image.html
```
- [2] open terminal and ssh to posbox:
``` 
ssh pi@your-posbox-ip-address   Example: ssh pi@192.168.1.5
``` 
```
with password: raspberry
```
- [3] go to root: 
```
sudo su
```
- [4] mount ssd disk of pi
```
mount -o remount,rw /
```
- [5] go to odoo path addons
```
cd /home/pi/odoo
```
- [5] change permission of addons
```
sudo chmod 777 -R /home/pi/odoo/addons
```
- [6] unzip file i send to you and upload to 
```
/home/pi/odoo/addons
``` 
- [7] reboot posbox
```
sudo reboot now
```
- [8] get ip of posbox and go to Odoo Menu:
```
Point Of Sale / Retail Operations / IOT boxes
Proxy: your posbox ip only, example: 192.168.1.5
Port: 8069
``` 
- [9] go to Point Of sale / Select One pos setting profile
```
Go to tab Sync between Session
Check to field: Sync Between Session Offline is true
Select IOT Boxes and save
```
- [10] Made sure all POS Sessions need to sync setting Offline the same IOT Box at step 9
