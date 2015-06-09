# Taskbox
Task Box guy

##Users
In order to make all the things not require root installs, we have two special users on each machine, node-app-files and node-app-run.

**node-app-files** owns everything

**node-app-run** can read everything but not write.

When you login ensure you are using the correct user for the task you are working on via:
sudo su - {user}


Sits and spins and polls some shit and then sends up a bunch o Kinesis events and whatnot.

