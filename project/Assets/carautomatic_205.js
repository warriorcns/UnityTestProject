// ----------- Modified CAR TUTORIAL SAMPLE PROJECT, by The CoalGuru (based on a scripts by Andrew Gotow 2009,
// ----------- misc tutorials and open resources.

// Please put the script into the root car GameObject. 

// Variables ---------------------------------------------------------------------------------------------

// All Wheel components down the hierarchy
var wheels : WheelSet [];

// is car AI Control?
var aiControl = true;

// Center of Mass correction.
var massCorrection : Vector3;

// Brake and handbrake torques.
var brakes = 100.0;
var handbrakes = 500.0;

// How much velocity based down-pressure force to be applied.
var downpressFx = 0.5;

// Steering: wheels can turn up to lowSpeedSteerAngle when car is still;
// and up to highSpeedSteerAngle when car goes at highSpeed km/h.
// This is to decrease steering at high velocities so that playing with
// plain keyboard is possible.
var minSteer = 45.0;
var maxSteer = 10.0;
var highSpeed = 100.0;

var WheelRadius = 0.32;

// These variables are for the gears, the array is the list of ratios. The script
// uses the defined gear ratios to determine how much torque to apply to the wheels.
var GearRatio : float[];
private var CurrentGear : int = 1;

// These variables are just for applying torque to the wheels and shifting gears.
// using the defined Max and Min Engine RPM, the script can determine what gear the
// car needs to be in.
var EngineTorque : float = 400.0;
var MaxRPM : float = 600.0;
var MinRPM : float = 1000.0;
var RPMLimit : float = 2000.0;
private var EngineRPM : float = 0.0;
private var WheelRPM : float = 0.0;
private var steer : float = 0.0;

var springLength = 0.1;
var springForce = 2200;
var damperForce = 50;

var FrontSlip = 0.98;
var SideSlip = 0.1;
var WheelMass = 5;

var SlipPrefab : GameObject;

private var WheelsN : int;
private var MWheelsN : int = 0;

class WheelSet { 
   var wheelrotation = 0.0; 
   var wCollider : WheelCollider; 
   var wheelgraphic : Transform;
   var wheelaxle : Transform; 
   var lastSkidMark = -1;
   var steered = false; 
   var powered = false; 
   var handbraked = false; 
   var originalRotation : Quaternion;
   var originalBrakeRotation : Quaternion;
}; 


// UI indicators
var uiSpeed : GUIText;
var uiMotorRpm : GUIText;

// --------------------------- Start ---------------------------------------------------------------------

function Start () {



	// wheels enumerator
  if (wheels) {
	WheelsN = wheels.length;
    for (w in wheels) { 
   	          
      w.originalRotation = w.wheelgraphic.rotation; 
      w.originalBrakeRotation = w.wheelaxle.rotation;
 
           //create collider 
      colliderObject = new GameObject("WheelC"); 
      colliderObject.transform.parent = transform; 
      colliderObject.transform.position = w.wheelgraphic.position;
      w.wCollider = colliderObject.AddComponent(WheelCollider); 
      w.wCollider.suspensionDistance = springLength; 
      w.wCollider.suspensionSpring.spring = springForce; 
      w.wCollider.suspensionSpring.damper = damperForce; 
      w.wCollider.forwardFriction.stiffness = FrontSlip; 
      w.wCollider.sidewaysFriction.stiffness = SideSlip;
      w.wCollider.mass = WheelMass; 
      w.wCollider.radius = WheelRadius;
      if (w.powered) MWheelsN++;     
    }    
    CurrentGear = 0;
    // mass center adjustment 
    rigidbody.centerOfMass = massCorrection;
  
    

    Debug.Log(rigidbody.centerOfMass);
  }
  else Debug.Log("No wheels assigned!");
  if (!MWheelsN) Debug.Log("No motor wheels assigned!");
}

// ---------------------------- Update -------------------------------------------------------------------

function Update () {
	
	// AI realisation
if (!aiControl) {	
	var gasAmount = Input.GetAxis("Vertical");
	var steerAmount = Input.GetAxis ("Horizontal");
	var brakeAmount = Input.GetButton("Jump");
    }
    
	// This is to limit the maximum speed of the car, adjusting the drag probably isn't the best way of doing it,
	// but it's easy, and it doesn't interfere with the physics processing.
	rigidbody.drag = rigidbody.velocity.magnitude / 150;
   
	// The current speed in km/h
	var kmPerH = rigidbody.velocity.magnitude / 3.6;
	var handTorque = 0.0;
	if( brakeAmount )
		handTorque = handbrakes;
		
	// Compute the engine RPM based on the average RPM of all motorised wheels, 
	// then call the shift gear function and check if car grounded
	var SumRPM : float = 0.0;
	var isCarGrounded = false;
	
	for( var NextWheel:WheelSet in wheels )
	{
		if ( NextWheel.powered) {
		         SumRPM -= NextWheel.wCollider.rpm;
		
		if( NextWheel.wCollider.isGrounded )
				 isCarGrounded = true; 
	    }		 
	}
           
    if (MWheelsN) {
    	
	     EngineRPM = WheelRPM * GearRatio[CurrentGear];
         WheelRPM  =  SumRPM  / MWheelsN ;
    }     
    else WheelRPM = 0;
    
	ShiftGears();

	// set the audio pitch to the percentage of RPM to the maximum RPM plus one, this makes the sound play
	// up to twice it's pitch, where it will suddenly drop when it switches gears.
	audio.pitch = Mathf.Abs(EngineRPM / MaxRPM) + 1.0 ;
	// this line is just to ensure that the pitch does not reach a value higher than is desired.
	if ( audio.pitch > 2.0 ) {
		audio.pitch = 2.0;
	}

	// apply downpressure to the running grounded car
	if( isCarGrounded )
	{		
		var downPressure = Vector3(0,0,0);
		downPressure.y = -Mathf.Pow(rigidbody.velocity.magnitude, 1.2) * downpressFx;
		downPressure.y = Mathf.Max( downPressure.y, -70 );
		rigidbody.AddForce( downPressure, ForceMode.Acceleration );
	}
	
		// motor & brake ****************************************************************
		
	var drTorque = 0.0;
	var brTorque = 0.0;
	var GearTorque = EngineTorque / GearRatio[CurrentGear];
	if( Mathf.Abs(gasAmount) > 0.1 ) // if gas is pressed
	{
		if( WheelRPM * gasAmount < 0.0 )
		{
			// user is trying to drive in the opposite direction - treat that as brake
			brTorque = brakes;
		}
		if (EngineRPM < RPMLimit)
			drTorque = gasAmount * GearTorque;
	}

	// steering **************************************************************************
    steer = steerAmount * minSteer;	
	// find maximum steer angle (dependent on car velocity)
	var limSteer = Mathf.Lerp( minSteer, maxSteer, kmPerH / highSpeed );
    steer = limSteer * steerAmount;

    // rolling ***************************************************************************
	// Apply the values to the wheels.	The torque applied is divided by the current gear, and
	// multiplied by the user input variable.
	// the steer angle is an arbitrary value multiplied by the user input.
	
	for (i=0;i<WheelsN;i++) {
	
	    UpdateWheel( i, handTorque, drTorque, brTorque,  steer );
	    	
	}
	
	
		// update UI texts if we have them ***********************************************
	if( uiSpeed != null )
//		uiSpeed.text = kmPerH.ToString("f1") + "\tkm/h";
        uiSpeed.text = rigidbody.velocity.magnitude.ToString("f1") + "\tkm/h";
	if( uiMotorRpm != null )
		uiMotorRpm.text = EngineRPM.ToString("f0") + "\trpm";
}


       //  update gears *******************************************************************


function ShiftGears() {
	// this funciton shifts the gears of the vehcile, it loops through all the gears, checking which will make
	// the engine RPM fall within the desired range. The gear is then set to this "appropriate" value.
	if ( EngineRPM >= MaxRPM ) 
	{
		var AppropriateGear : int = CurrentGear;
		
		for ( var i = 0; i < GearRatio.length; i ++ ) 
		{
			if ( WheelRPM * GearRatio[i] < MaxRPM ) 
			{
				AppropriateGear = i;
				break;
			}
		}
		
		CurrentGear = AppropriateGear;
	}
	
	if ( EngineRPM <= MinRPM ) 
	{
		AppropriateGear = CurrentGear;
		
		for ( var j = GearRatio.length-1; j >= 0; j -- ) 
		{
			if ( WheelRPM * GearRatio[j] > MinRPM ) 
			{
				AppropriateGear = j;
				break;
			}
		}
		
		CurrentGear = AppropriateGear;
	}
}

function UpdateWheel( num : int, handbrake : float, motion : float, brake : float, steer : float )
{
		// raycast wheel amortisation
	var hit : RaycastHit;
	var ColliderCenterPoint : Vector3 = wheels[num].wCollider.transform.TransformPoint( wheels[num].wCollider.center );
	
	if ( Physics.Raycast( ColliderCenterPoint, -wheels[num].wCollider.transform.up, hit, wheels[num].wCollider.suspensionDistance + wheels[num].wCollider.radius ) ) {
		wheels[num].wheelgraphic.transform.position = hit.point + (wheels[num].wCollider.transform.up * wheels[num].wCollider.radius);
		wheels[num].wheelaxle.transform.position = hit.point + (wheels[num].wCollider.transform.up * wheels[num].wCollider.radius);
	}else{
		wheels[num].wheelgraphic.transform.position = ColliderCenterPoint - (wheels[num].wCollider.transform.up * wheels[num].wCollider.suspensionDistance);
		wheels[num].wheelaxle.transform.position = ColliderCenterPoint - (wheels[num].wCollider.transform.up * wheels[num].wCollider.suspensionDistance);
	}

	// now set the wheel rotation to the rotation of the collider combined with a new rotation value. This new value
	// is the rotation around the axle, and the rotation from steering input.

if (wheels[num].powered)
   {	
	wheels[num].wCollider.motorTorque = -motion;
   }
   
	// increase the rotation value by the rotation speed (in degrees per second)
	wheels[num].wheelrotation += wheels[num].wCollider.rpm * ( 360/60 ) * Time.deltaTime;
   
if (wheels[num].steered)
   {	
	// now set the wheel steer to the steer of the collider.
	wheels[num].wCollider.steerAngle = steer;
	wheels[num].wheelgraphic.transform.rotation = wheels[num].wCollider.transform.rotation * Quaternion.Euler( wheels[num].wheelrotation, wheels[num].wCollider.steerAngle, 0 );
	wheels[num].wheelaxle.transform.rotation = wheels[num].wCollider.transform.rotation * Quaternion.Euler( wheels[num].originalBrakeRotation.x*2*3.1416, wheels[num].wCollider.steerAngle, 0 );
   }
else
    wheels[num].wheelgraphic.transform.rotation = wheels[num].wCollider.transform.rotation * Quaternion.Euler( wheels[num].wheelrotation, 0, 0 );  
   
   // apply brake or handbrake, depending on which is larger
if( wheels[num].handbraked && handbrake > brake )
	 	brake = handbrake;

	wheels[num].wCollider.brakeTorque = brake;

       
	// define a wheelhit object, this stores all of the data from the wheel collider and will allow us to determine
	// the slip of the tire.
	var CorrespondingGroundHit : WheelHit;
	wheels[num].wCollider.GetGroundHit( CorrespondingGroundHit );
	
	// if the slip of the tire is greater than 2.0, and the slip prefab exists, create an instance of it on the ground at
	// a zero rotation.
	if ( Mathf.Abs( CorrespondingGroundHit.sidewaysSlip ) > 2.0 ) {
		if ( SlipPrefab ) {
			Instantiate( SlipPrefab, CorrespondingGroundHit.point, Quaternion.identity );
		}
	}
}


@script RequireComponent (Rigidbody) 
@script RequireComponent (AudioSource) 
