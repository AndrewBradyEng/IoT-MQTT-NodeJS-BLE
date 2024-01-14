// code for subscribing and publishing to a button on a pet feeder
const deviceOfInterest = 'F4:40:D6:F8:C1:81' // MAC Address of Twitch microbit (End device)
var mqtt = require('mqtt') // NodeJS library for mqttt
const serviceOfInterestUuid = '00000001-0002-0003-0004-000000002000' //uuid of button service
const characteristicOfInterestUuid = '00000001-0002-0003-0004-000000002001' //uuid of read/notify characteristic of button service
const LEDServiceOfInterestUuid = '00000001-0002-0003-0004-000000003000' //uuid of LED service
const LEDCharacteristicOfInterestUuid = '00000001-0002-0003-0004-000000003001' //uuid of read characteristic of LED service
var buttonPressCount=0 // Button press counter, starting at 0
const maxButtonPressCount=20; //Max times button can be pressed / 2

const options = { // options to connect to web socket
  username: 'c20769825',
  password: 'hello123',
  host: '7c32181a42cd45e58b39e793c7d3462d.s2.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts',
};

//Connecting Section

var mqttClient  = mqtt.connect(options); // connect to the broker
var topicToSubscribeTo="feederSub" // Topic to subscribe and receive information from
var topicToPublishTo="feederPub" // Topic to publish data to

function publishCallback(error) {     // Error handling for publish
   if (error) {
    console.log("error publishing data");}}

mqttClient.on('connect', connectCallback); // When connected, connectCallback is listening for information on the topic which is subscribed to

function connectCallback() { // When connect event is called, subscribe to the topic and listen for information from the topic
  console.log("connected to cloud MQTT broker");
  mqttClient.subscribe(topicToSubscribeTo, subscribeCallback); //when connected to broker, subscribe to messages on topics specified in topicToSubscribeTo const
}

function subscribeCallback(error, granted) { // Error handling for subscribe
   if (error) {
    console.log("error subscribing to topic");}}

const main = async() => {
 
  const {createBluetooth}=require('node-ble') // Library for NodeJS bluetooth low energy
  const { bluetooth, destroy } = createBluetooth()

  // get bluetooth adapter
  const adapter = await bluetooth.defaultAdapter() //get an available Bluetooth adapter
  await adapter.startDiscovery() //using the adapter, start a device discovery session  
  console.log('discovering') // Text informing the user the program is looking for the bluetooth device (startDiscovery function)
 
  // look for a specific device
  const device = await adapter.waitDevice(deviceOfInterest)
  console.log('got device', await device.getAddress())// await device.getAddress())
  const deviceName = await device.getName()

  await adapter.stopDiscovery() // Stopping discovery after finding device.
  await device.connect() // Connect to device found


  const gattServer = await device.gatt()
  services = await gattServer.services() // Discover the services in the device
 
//Main Code
 
 if (services.includes(serviceOfInterestUuid)) { //uuid of service
  const primaryService = await gattServer.getPrimaryService(serviceOfInterestUuid)
  chars = await primaryService.characteristics()  
  charact = await primaryService.getCharacteristic(characteristicOfInterestUuid)

  await charact.startNotifications()
    charact.on('valuechanged', buffer => {
    ++buttonPressCount; // Increase button press counter

//Check if button has been pressed 10 times
if(buttonPressCount >= maxButtonPressCount){
    mqttClient.publish(topicToPublishTo, 'The feeder is empty. Please refill!', publishCallback);
    console.log('The feeder is empty. Please refill!');
}

else if(buttonPressCount%2==1){//If buttton is currently being held
  console.log("The food is being dispensed" )
  mqttClient.publish(topicToPublishTo, 'The food is being dispensed', publishCallback);
}

else if(buttonPressCount%2==0){//If button has been let go
    mqttClient.publish(topicToPublishTo, 'The feeder has been used: ' +(buttonPressCount/2) + " times", publishCallback);
    console.log('The feeder has been used: ' +(buttonPressCount/2) + " times")
} 
})  
}
 if (services.includes(LEDServiceOfInterestUuid)) { //uuid of LED service
    const primaryLEDService = await gattServer.getPrimaryService(LEDServiceOfInterestUuid)
    const LEDChar = await primaryLEDService.getCharacteristic(LEDCharacteristicOfInterestUuid); //uuid of read/write characteristic of LED service

    mqttClient.on('message', messageEventHandler);
    async function messageEventHandler(topic, message, packet) {
        console.log("Warning : " + message); // Prompting the user what cause was inputted into the web socket for the warning light being turned on
        mqttClient.publish(topicToPublishTo, 'Warning! ', publishCallback);  // Publishing 'warning' to the websocket, informing user LED was turned on in response to their input
        await LEDChar.writeValue(Buffer.from([01])); //turn the LED on when a message arrives from the Broker
    }
    await LEDChar.writeValue(Buffer.from([00])); // LED is off by default
}
}
main()
  .then()
  .catch(console.error)