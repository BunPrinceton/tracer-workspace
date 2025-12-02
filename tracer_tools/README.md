# tracer_tools

tracer_tools is a repository of small functions created for the busy neuroscientist to simplify and streamline some of the useful packages for interacting with common industry tools like Neuroglancer and CAVE. The goal is to allow folks who are interested in accessing or processing backend data to make use of these powerful tools without having to spend hundreds of hours familiarizing themselves with how they all fit together. Many of these functions are deisnged to be integrated into other tools or modified for unique use cases. Users will need basic familiarity with the Python programming language in order to use the various functions, and will need to install any packages on which the functions depend [ADD INSTALL GUIDE/LIST DEPENDENCIES HERE].

This readme, as well as this repo, is a work in progress and will be updated regularly with no warning.

The **main_test_notebook** file contains all the functions of interest. All other files are currently scratchpads for the various contributors to see one anothers' work.

## Core Terminology

**CAVE** - connectome annotation versioning engine, the software used to store and access backend information about datastacks. Github repo [here](https://github.com/CAVEconnectome/CAVEclient), documentation [here](https://caveclient.readthedocs.io/en/latest/)

**datastack** - all the data associated with a particular brain (or other tissue) image. Includes EM images, 3D segmentation data, and tables of information (synapses, cell type labels, etc.)

**neuroglancer (NG)** - a UI for interacting with 2D and 3D renderings of the backend data often used in neuroscience. Github repo [here](https://github.com/google/neuroglancer). There are multiple branches of NG for specific purposes, like FlyWire or Spelunker

**resolution** - the actual, physical dimensions in nanometers represented by one voxel in the x, y, and z directions (e.g. [4, 4, 40])

**root ID** - the unique 18-digit numeric identifier for a given version of a single neuron. Often referred to as segment/seg ID

**segmement/segmentation** - the current pattern of supervoxels that make up one or more neurons and their representation in 2D or 3D

**supervoxel** - the smallest rearrangeable unit of a segment, made up of multiple voxels, not a consistent size, created by the algorithm that generated the segmentation. Supervoxels cannot be broken apart.

**voxel** - one unit of 3D space, the actual spatial dimensions of which vary from datastack to datastack

## Current functions

### bbox_corners_from_center
This function takes a list of xyz coordinates for a point, and the dimensions, in voxels, of a bounding box to be centered on that point and returns two xyz coordinates for the corners of said bounding box. It is resolution agnostic.

### build_ng_link
!!!WARNING: THIS FUNCTION IS A PROTOTYPE AND CURRENTLY ONLY WORKS WITH THE "flywire_fafb_production" and "brain_and_nerve_cord" DATASTACKS!!! This function takes a list of root IDs and a datastack name and generates a neuroglancer link with those segments selected. It can also be used to add synapses annotations by setting "incoming" and/or "outgoing" = True. To turn all neurons white, set white=True. To filter out synapses with low cleft scores in FlyWire, set the value of "cleft_thresh" (this feature doesn't work with BANC). If synapses are requested, the output also includes total counts of incoming and/or outgoing synapses.

### calc_distance
This function takes two sets of voxel point coordinates as listed integers (e.g. [145983, 59737, 3304] and [147352, 59765, 3184]) along with the xyz resolution in nanometers per voxel (e.g. [4,4,40]) and returns the 3-dimensional distance in nanometers between the two points (in this case 7282.796166308652 nm).

### coords_to_root
This function takes xyz coordinates as either a single list (e.g. [x,y,z]) or a list of lists (e.g. [[x1, y1, z1], [x2, y2, z2]]) and the name of a datastack as a string (e.g. "brain_and_nerve_cord") and returns a list of root IDs at those points. Currently only guaranteed to work with "brain_and_nerve_cord" (BANC), but support for other datasets will be forthcoming.

### convert_coord_res
This function takes a list of xyz coordinates for a point and converts it from one resolution (res_current) to another (res_desired). By default, both of these parameters are set to nanometer resolution (i.e. [1,1,1]) - this is intended to facilitate quick conversion to or from nm resolution, a common task for many applications. As an example, the call convert_coord_res([1,2,3], res_current=[16,16,40], res_desired=[4,4,40]) would return a value of [4, 8, 3].

### generate_color_list
This function takes a positive integer number and generates a list of that many hexadecimal values spaced evenly around a color wheel for use in coloring segments in neuroglancer. The option alternate_brightness can be set to a value between 0.0 and 1.0 in order to darken or lighten each neighboring color for lists of more than 10 segments.

### get_all_stacks
This function gets a list of all the current datastack names available in the CAVE tool. It requires no argument. These names can then be used to set a CAVEclient object for other uses. They can also be used to look up dataset information as well as lists of available tables and their associated metadata using several of the other functions in this repo.

### get_nt
This function takes one or more root IDs and a datastack name and returns neurotransmitter information for those segments. If one ID is entered (as a string, integer, or listed str or int), the user can also request detailed information for the incoming synapse neurotransmitters. Specifically, the output will be a list where the first item is the neurotransmitter with the highest average score, the second item is a dictionary of the incoming neurotransmitter averages, and the third item will be a plotly grpah object in the form of a violin plot for the neurotransmitter scores. If a list of 2 or more IDs are submitted (list of str or int), the return will be a list of the neurotransmitter with the highest average score for each ID in the same order as the IDs submitted.

### get_stack_data
This function takes a datastack name as a string and returns the general information for that datastack, like the urls for the various image hosting, the resolution of the voxels, and the names of various tables of related information.

### get_stack_tables
This function takes a datastack name as a string and returns a list of names for all of the available CAVE tables for a given dataset (usually includes synapses, cell types, and any other relevant project information).

### get_state_json_from_url
This function takes a shortened neuroglancer link and a datastack name and returns the long-form state JSON, from which various information can be pulled programatically.

### get_synapse_counts
This function takes a list of root IDs and a datastack name and returns the incoming, outgoing, and total synapses for each ID as a dictionary. A cleft score threshold can also be entered to discard synapses below a desired number - currently only works for the "flywire_fafb_production" datastack.

### get_table
This function takes the name of a table and its datastack and return a dataframe with the entire table (some of these are quite large, and my take a while for slow connections).

### get_table_data
This function takes the name of a table and its datastack and returns the metadata for that table, like what it contains, who created it, and when.

### root_to_svs
This function takes a single root ID and its datastack name and returns a list of all the supervoxels that make it up.

### root_to_vol
This function takes a single root ID and its datastack name and returns the volume in cubic micrometers.

### stringify_int_list
This function takes a list of integers (for our purposes this is most often a list of root IDs) and converts each item to a string. This is often useful for avoiding certain issues that can arise around 18-digit segment IDs trying to be treated as 32-bit integers with older software or automatically being converted into scientific notation sometimes. Since we never need to do math on root IDs, passing them around makes more sense. If any code requires that a root ID be passed as an integer, it can simply be converted back as it's passed in using the int() function.

### sv_to_root
This function takes a single supervoxel ID and its datastack name and returns the root ID of the segment the supervoxel is currently a part of.

### visualize_skeletons
This function takes a list of root ids and a datastack name (default is BANC) and generates a microviewer window to visualize the 3D structure and thickness of those neurons' skeletons




