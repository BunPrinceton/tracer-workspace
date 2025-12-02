import cloudvolume
from caveclient import CAVEclient
import pandas as pd
from nglui.statebuilder import *
import json
from osteoid import Skeleton
import numpy as np
import microviewer
import time
import sys
import plotly.graph_objects as go
import statistics


def bbox_corners_from_center(coords, dims):
    """Create an empty link with a bounding box of given dimensions centered on input coords.

    Arguments:
    coord -- xyz coords for centerpoint of bounding box in 4x4x40nm resolution (list of ints)
    dims -- xyz dimensions in voxels (list of ints)

    Returns:
    coord_list -- coordinates of corner points for bbox (list of lists of ints)
    """

    # ensures starting dims are even numbers #
    for dim in dims:
        if dim % 2 != 0:
            dim += 1

    # creates empty lists #
    min_coord = [int(coord - dim / 2) for coord, dim in zip(coords, dims)]
    max_coord = [int(coord + dim / 2) for coord, dim in zip(coords, dims)]

    corners = [min_coord, max_coord]

    return corners


### !!!!!!! PROTOTYPE, CURRENTLY ONLY WORKS WITH FLYWIRE PRODUCTION and BANC !!!!!!! ###
from caveclient import CAVEclient
import pandas as pd
from nglui.statebuilder import *
import json


def build_ng_link(
    root_ids,
    datastack,
    incoming=False,
    outgoing=False,
    cleft_thresh=0.0,
    white=False,
    custom_colors=False,
):
    """Build a neuroglancer state url from a list of root IDs.

    Arguments:
    root_ids -- a list of 18-digit root IDs (list of str)
    datastack -- the name of the datastack the root IDs belong to (str)
    incoming -- whether to include incoming synapses (bool, default False)
    outgoing -- whether to include outgoing synapses (bool, default False)
    cleft_thresh -- the cleft score threshold below which to exclude synapses, currently only works for flywire (float, default 0.0)
    white -- whether or not to make all the segment colors white (bool, default False)
    custom_colors -- if a list of hex values is passed they will be used to color the neurons in the same order as the root_ids list (list of str, default False)

    Returns:
    ng_url -- the url for the constructed neuroglancer state (str)
    """

    ### CURRENTLY ASSUMES ROOT COLUMN NAMES ARE "pre/post_pt_root_id" ###
    ### CURRENTLY ASSUMES COORD COLUMN NAMES ARE "pre/post_pt_position" ###

    ### CURRENTLY ASSUMES CLEFT SCORE COLUMN NAME IS "cleft_score", ONLY WORKS WITH FLYWIRE ###
    cleft_score_column_name = "cleft_score"

    # sets CAVE client object using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # gets metadata for chosen datastack as dict #
    stack_info = client.info.get_datastack_info()

    # gets base url from stack info #
    base_url = stack_info["viewer_site"]

    # gets viewer resolution from stack info #
    viewer_res = [
        stack_info["viewer_resolution_x"],
        stack_info["viewer_resolution_y"],
        stack_info["viewer_resolution_z"],
    ]

    # if synapses are requested, sets name of synapse table using metadata #
    if incoming == True or outgoing == True:
        synapse_table_name = stack_info["synapse_table"]

    # determines names of synapse table columns and ng tabs based on arguments #
    # also sets syn_state variable for use later #
    if incoming == True and outgoing == False:
        syn_state = "in"
        syn_col_name_1 = "post_pt_root_id"
        syn_tab_name_1 = "Incoming Synapses"
    elif outgoing == True and incoming == False:
        syn_state = "out"
        syn_col_name_1 = "pre_pt_root_id"
        syn_tab_name_1 = "Outgoing Synapses"
    elif incoming == True and outgoing == True:
        syn_state = "both"
        syn_col_name_1 = "post_pt_root_id"
        syn_tab_name_1 = "Incoming Synapses"
        syn_col_name_2 = "pre_pt_root_id"
        syn_tab_name_2 = "Outgoing Synapses"
    else:
        syn_state = "none"

    # converts root IDs to integers for passing into query_table method #
    root_ids = list(map(int, root_ids))

    # queries synapse table based on arguments #
    if syn_state != "none":
        syn_df_1 = client.materialize.query_table(
            synapse_table_name,
            filter_in_dict={syn_col_name_1: root_ids},
        )

        # removes synapses with cleft scores below threshold #
        if cleft_thresh > 0.0:
            syn_df_1 = syn_df_1[
                syn_df_1[cleft_score_column_name] >= float(cleft_thresh)
            ].reset_index(drop=True)
        # makes df of just the coordinates converted into viewer resolution #
        syn_coords_df_1 = pd.DataFrame(
            {
                "pre": [
                    [coord / res for coord, res in zip(point, viewer_res)]
                    for point in syn_df_1["pre_pt_position"]
                ],
                "post": [
                    [coord / res for coord, res in zip(point, viewer_res)]
                    for point in syn_df_1["post_pt_position"]
                ],
            }
        )
        # adds df of synapse coords to list for passing into statebuilder #
        syn_df_list = [syn_coords_df_1]
        # gets count of number of synapses #
        syn_count_1 = len(syn_coords_df_1)

        # repeats the process for the second direction if both incoming and outgoing are requested #
        if syn_state == "both":
            syn_df_2 = client.materialize.query_table(
                synapse_table_name,
                filter_in_dict={syn_col_name_2: root_ids},
            )
            if cleft_thresh > 0.0:
                syn_df_2 = syn_df_2[
                    syn_df_2[cleft_score_column_name] >= float(cleft_thresh)
                ].reset_index(drop=True)
            syn_coords_df_2 = pd.DataFrame(
                {
                    "pre": [
                        [coord / res for coord, res in zip(point, viewer_res)]
                        for point in syn_df_2["pre_pt_position"]
                    ],
                    "post": [
                        [coord / res for coord, res in zip(point, viewer_res)]
                        for point in syn_df_2["post_pt_position"]
                    ],
                }
            )
            syn_df_list.append(syn_coords_df_2)
            syn_count_2 = len(syn_coords_df_2)

    # makes empty list to fill with layers #
    layer_list = []

    # sets configuration for EM layer #
    img = ImageLayerConfig(
        name="EM",
        source=client.info.image_source(),
    )

    # adds EM layer to list #
    layer_list.append(img)

    seg_source = client.info.segmentation_source()
    if datastack == "brain_and_nerve_cord":
        split_url = seg_source.split("https")
        seg_source = split_url[0] + "middleauth+https" + split_url[1]

    # determines color scheme for segmentation #
    if white == True:
        color_list = ["#ffffff" for x in root_ids]
    elif custom_colors != False:
        color_list = custom_colors
    else:
        color_list = generate_color_list(len(root_ids), alternate_brightness=0.3)

    # defines segmentation layer config #
    seg = SegmentationLayerConfig(
        name="Segmentation",
        source=seg_source,
        fixed_ids=root_ids,
        fixed_id_colors=color_list,
    )

    # adds segmentation layer to list #
    layer_list.append(seg)

    # defines synapse layer config(s) if requested #
    if syn_state != "none":
        # defines configuration for line annotations #
        lines = LineMapper(
            point_column_a="pre",
            point_column_b="post",
        )

        if datastack == "flywire_fafb_production":
            in_syn_color = "#FFFF00"
            out_syn_color = "#0000FF"
        else:
            in_syn_color = "#FF6E4A"
            out_syn_color = "#3D81FF"

        # ensures consistent color coding for incoming and outgoing synapses #
        if syn_state == "out":
            syn_1 = AnnotationLayerConfig(
                name=syn_tab_name_1,
                mapping_rules=lines,
                color=out_syn_color,
            )
        else:
            syn_1 = AnnotationLayerConfig(
                name=syn_tab_name_1,
                mapping_rules=lines,
                color=in_syn_color,
            )
        layer_list.append(syn_1)
        # repeats process if in and output synapses requested #
        if syn_state == "both":
            syn_2 = AnnotationLayerConfig(
                name=syn_tab_name_2,
                mapping_rules=lines,
                color=out_syn_color,
            )

    # VIEW SET, CURRENTLY NONFUNCTIONAL #
    if datastack == "flywire_fafb_production":
        view_options = {
            "position": [130900, 57662, 3052],
            "zoom_3d": 6.64,
        }
    elif datastack == "brain_and_nerve_cord":
        view_options = {
            "position": [
                127339,
                142245,
                3041,
            ],
            # "zoom_3d": 6.64,
        }

    # defines state builder by passing in rules for img, seg, and anno layers #
    sb_1 = StateBuilder(
        layer_list,
        resolution=viewer_res,
        # view_kws=view_options,
    )

    # chooses target site name based on datastack to handle pre-spelunker datasets #
    if datastack == "flywire_fafb_production":
        target_site_name = "seunglab"
    else:
        target_site_name = "spelunker"

    # converts the state into a JSON while feeding in synapse coordinates #
    if syn_state != "none":
        if syn_state == "both":
            # creates second statebuilder to handle second annotation layer #
            sb_2 = StateBuilder([syn_2])
            # chains statebuilders together #
            # this method will likely be deprecated in the near future #
            chained_sb = ChainedStateBuilder([sb_1, sb_2])
            # create a state json using the render_state method of the StateBuilder object(s) #
            state_json = json.loads(
                chained_sb.render_state(
                    [syn_coords_df_1, syn_coords_df_2],
                    return_as="json",
                    target_site=target_site_name,
                )
            )
        else:
            state_json = json.loads(
                sb_1.render_state(
                    syn_coords_df_1, return_as="json", target_site=target_site_name
                )
            )
    else:
        state_json = json.loads(
            sb_1.render_state(return_as="json", target_site=target_site_name)
        )

    if datastack == "flywire_fafb_production":
        state_json["perspectiveOrientation"] = [
            -0.029998891055583954,
            -0.008902468718588352,
            -0.02068145014345646,
            -0.9992963075637817,
        ]
    elif datastack == "brain_and_nerve_cord":
        state_json["perspectiveOrientation"] = [
            -0.006392207462340593,
            -0.9995864033699036,
            -0.0023922761902213097,
            -0.02793547324836254,
        ]

    # sends JSON state to remote state server and gets back state ID #
    new_state_id = client.state.upload_state_json(state_json)

    # builds url using the state ID and the base url for the dataset #
    url = client.state.build_neuroglancer_url(
        state_id=new_state_id,
        ngl_url=base_url,
    )

    if syn_state == "in":
        print("Incoming Synapses:", syn_count_1)
    elif syn_state == "out":
        print("Outgoing Synapses:", syn_count_1)
    elif syn_state == "both":
        print("Incoming Synapses:", syn_count_1)
        print("Outgoing Synapses:", syn_count_2)
    print(url)

def calc_distance(point_a, point_b, xyz_resolution):
    """Calculate distance in 3D between two points in nanometers based on the viewer resolution.
    
    Arguments:
    point_a -- xyz coordinates of first point (list of ints)
    point_b -- xyz coordinates of second point (list of ints)
    xyz_resolution -- the nanometers per voxel in the x, y, and z directions (list of ints)

    Returns:
    dist -- the 3D distance in nanometers between points a and b"""

    # calculates distance in x, y, and z dimensions #
    xdist = (xyz_resolution[0] * point_a[0]) - (xyz_resolution[0] * point_b[0])
    ydist = (xyz_resolution[1] * point_a[1]) - (xyz_resolution[1] * point_b[1])
    zdist = (xyz_resolution[2] * point_a[2]) - (xyz_resolution[2] * point_b[2])

    # uses distance formula to calculate distance in 3D #
    dist = ((xdist ** 2) + (ydist ** 2) + (zdist ** 2)) ** 0.5

    return dist

def convert_coord_res(coords, res_current=[1, 1, 1], res_desired=[1, 1, 1]):
    """Convert coordinates between two resolutions.

    Arguments:
    coords -- x,y,z coordinates in current resolution (list of ints)
    res_current -- current x,y,z resolution in nm/voxel, e.g. [4, 4, 40] (list of ints, default [1,1,1])
    res_desired -- desired x,y,z resolution in nm/voxel, e.g. [16, 16, 40] (list of ints, default [1,1,1])

    Returns:
    converted_coords -- x,y,z coordinates after conversion (list of ints)
    """

    # converts coordinates using volume resolution #
    converted_coords = [
        int(coord / (res_des / res_cur))
        for coord, res_cur, res_des in zip(coords, res_current, res_desired)
    ]

    return converted_coords


def coords_to_root(coord_list, datastack):
    """Convert xyz coordinates to root id(s).

    Keyword arguments:
    coord_list -- list of lists of x,y,z coordinates in viewer resolution (list of lists of ints), will also take a single list of ints
    datastack -- the name of the datastack to pull the segmetnation from (str) [CURRENTLY ONLY SUPPORTS BANC FOR SURE]

    Returns:
    root_result
    """

    # turns single list of ints into list of list of ints for use in loop #
    if type(coord_list[0]) == int and len(coord_list) == 3:
        coord_list = [coord_list]

    # sets client using datastack name #
    client = CAVEclient(datastack_name=datastack)

    def to_root(coords):
        # pulls datastact info dictionary using stack name #
        stack_info = client.info.get_datastack_info()

        url = stack_info["segmentation_source"]
        split_url = url.split("https")
        chunkedgraph_url = split_url[0] + "middleauth+https" + split_url[1]

        # sets cloud volume to BANC #
        cv = cloudvolume.CloudVolume(
            chunkedgraph_url,
            use_https=True,
        )

        # adjusts coord resolution by dividing mip0 res by viewer res, then dividing coords by result #
        viewer_res = [
            stack_info["viewer_resolution_x"],
            stack_info["viewer_resolution_y"],
            stack_info["viewer_resolution_z"],
        ]
        mip0_res = cv.meta.resolution(0)
        resolution = [mip0 / viewer for mip0, viewer in zip(mip0_res, viewer_res)]
        coords = [coord / res for coord, res in zip(coords, resolution)]

        # gets root ID using download_point method from cloudvolume #
        root_result = str(
            cv.download_point(
                coords,
                size=1,
                agglomerate=True,
            )[
                0
            ][0][
                0
            ][0]
        )

        return root_result

    root_list = [to_root(coords) for coords in coord_list]

    return root_list


def generate_color_list(number_of_colors, alternate_brightness=0.0):
    """Generate a list of hex values for coloring neurons as differently as possible based on the number of neurons.

    Arguments:
    number_of_colors -- the number of segments you need colors for (int)
    alternate_brightness -- value between 0 and 1 indicating how much to vary the brightness of neighboring colors, only effects list of 11 or more colors (float, default 0.0)

    Returns:
    colors --  a list of hex values to use for coloring segments (list of str)
    """

    # handles input if alternate_brightness is outside the range 0 to 1 #
    if alternate_brightness < 0 or alternate_brightness > 1:
        raise ValueError("alternate_brightness must be a value between 0.0 and 1.0.")

    # sortens number_of_colors to n for simplicity #
    n = number_of_colors

    # hard coded default color list for numbers of segments <= 10 #
    default_list = [
        "#ff5533",
        "#FF9C33",
        "#FFDD33",
        "#B9DA00",
        "#A8FFA8",
        "#00A870",
        "#B0FEFF",
        "#469FE3",
        "#CC85FF",
        "#FF40DF",
    ]

    # determines colors if 10 or fewer segments #
    if n == 1:
        return [default_list[2]]  # return yellow for single-id cases
    elif n == 2:
        colors = [default_list[i] for i in [0, 7]]  # red and blue #
    elif n == 3:
        colors = [default_list[i] for i in [0, 2, 7]]  # add yellow #
    elif n == 4:
        colors = [default_list[i] for i in [0, 2, 4, 7]]  # add green #
    elif n == 5:
        colors = [default_list[i] for i in [0, 2, 4, 7, 8]]  # add purple
    elif n == 6:
        colors = [default_list[i] for i in [0, 1, 2, 4, 7, 8]]  # add orange #
    elif n == 7:
        colors = [default_list[i] for i in [0, 1, 2, 4, 7, 8, 9]]  # add magenta #
    elif n == 8:
        colors = [default_list[i] for i in [0, 1, 2, 4, 6, 7, 8, 9]]  # add cyan #
    elif n == 9:
        colors = [
            default_list[i] for i in [0, 1, 2, 3, 5, 6, 7, 8, 9]
        ]  # split green into yellow- and blue-green #
    elif n == 10:
        colors = default_list

    # determines colors if more than 10 segments #
    elif n > 10:
        # sets starting positions on hue wheel #
        current_pos = 0
        # determines increment based on max steps of 1530 / number of steps needed #
        increment = int((1530) / n)
        # makes list of positions to fill starting with true red at 0 #
        positions = [0]
        # fills position list by adding increment to current position #
        for x in range(n - 1):
            current_pos += increment
            positions.append(current_pos)
        # makes emtpy list to fill with rgb values #
        rgb_colors = []
        # generates rgb value list for each position #
        for position in positions:
            if position <= 255:
                rgb = [255, position, 0]  # add green #
            elif position <= 510:
                inc = position - 255
                rgb = [255 - inc, 255, 0]  # remove red #
            elif position <= 765:
                inc = position - 510
                rgb = [0, 255, inc]  # add blue #
            elif position <= 1020:
                inc = position - 765
                rgb = [0, 255 - inc, 255]  # remove green #
            elif position <= 1275:
                inc = position - 1020
                rgb = [inc, 0, 255]  # add red #
            elif position <= 1530:
                inc = position - 1275
                rgb = [255, 0, 255 - inc]  # remove blue #
            rgb_colors.append(rgb)

        # creates functions to darken or lighten a color by 20% #
        def darken(rgb):
            dark_rgb = []
            for channel in rgb:
                dark_rgb.append(int(channel * (1 - alternate_brightness)))
            return dark_rgb

        def lighten(rgb):
            light_rgb = []
            for channel in rgb:
                dif = 255 - channel
                light_rgb.append(int(channel + alternate_brightness * dif))
            return light_rgb

        # creates empty list to fill with modified colors #
        new_colors = []

        # creates counter based on number of colors #
        counter = n

        # if there are an odd number of colors handles first color manually without adjustment #
        if n % 2 != 0:
            new_colors.append(rgb_colors[0])
            counter -= 1
            del rgb_colors[0]

        # alternates between darkening and lightening each color in list #
        for color in rgb_colors:
            if counter % 2 == 0:
                new_colors.append(darken(color))
                counter -= 1
            else:
                new_colors.append(lighten(color))
                counter -= 1

        # sets rgb_colors equal to modified list #
        rgb_colors = new_colors

        # converts rgb to hex using string formatting #
        colors = [
            "#"
            + "{:02x}".format(color[0])
            + "{:02x}".format(color[1])
            + "{:02x}".format(color[2])
            for color in rgb_colors
        ]

    # raises error when users input negative numbers or non-integers #
    else:
        raise ValueError("number_of_colors must be a positive integer.")

    return colors


def get_all_stacks():
    """Get a list of all the currently-documented CAVE datastack names.

    Returns:
    stacks -- a list of all the current datastack names (list of str)"""

    # sets generic cave client #
    client = CAVEclient()

    # pulls list of all currently-documented datastacks #
    stacks = client.info.get_datastacks()

    return stacks


def get_nt(root_ids, datastack, cleft_score_thresh=0, incoming=False):
    """Get the neurotransmitter data for one or more root IDs.

    Arguments:
    root_ids -- the 18-digit root ID(s) of the neuron(s) you want neurotransmitter data for (str or int if one input or else list of str or int for multiple)
    datastack -- the name of the datastack the root ID comes from
    cleft_score_thresh -- the cleft score threshold below which to filter out synapses (int, default 0)
    incoming -- whether or not to include detailed info about incoming nts or just the main output (bool, default False)

    Returns:
    out_max -- the name of the most likely output neurotransmitter (str)
    AND IF "incoming=True":
    in_nt_avg_dict -- the average for each incoming neurotransmitter (dict)
    in_fig -- a violin plot of the incoming neurotransmitters (plotly graph object)
    OR IF multiple root IDs submitted:
    out_max_list -- a list of the names of the most likely output neurotransmitters (list of str)
    """
    # CURRENTLY ONLY WORKS WITH FLYWIRE #
    # !!! WARNING: RELIES ON SYNAPSE COLUMN NAMES BEING "pre/post_root_id" !!! #

    # converts str or int to list format #
    if type(root_ids) == str or type(root_ids) == int:
        root_ids = [root_ids]

    # rejects input if user tries to get incoming data for more than 1 ID #
    if len(root_ids) > 1 and incoming == True:
        raise ValueError(
            "If 'incoming' is set to 'True' only 1 root id can be submitted."
        )

    # sets CAVE client object using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # gets metadata for chosen datastack as dict #
    stack_info = client.info.get_datastack_info()

    # sets synapse table name using stack info #
    synapse_table_name = stack_info["synapse_table"]

    # sets column name for outgoing synapses #
    outgoing_col_name = "pre_pt_root_id"

    # makes empty list to fill with max nt names #
    out_max_list = []

    # iterates over each root id #
    for root_id in root_ids:

        # creates outgoing synapse df by querying CAVE table #
        outgoing_syn_df = client.materialize.query_table(
            synapse_table_name,
            filter_in_dict={outgoing_col_name: [root_id]},
        )

        # drops synapses with cleft scores below threshold if greater than 0 #
        if cleft_score_thresh > 0:
            outgoing_syn_df = outgoing_syn_df[
                outgoing_syn_df["cleft_score"] >= float(cleft_score_thresh)
            ].reset_index(drop=True)

        # calculates averages of all outgoing synapse neurotransmitters #
        out_nt_avg_dict = {
            "gaba": round(statistics.mean(list(outgoing_syn_df["gaba"])), 2),
            "ach": round(statistics.mean(list(outgoing_syn_df["ach"])), 2),
            "glut": round(statistics.mean(list(outgoing_syn_df["glut"])), 2),
            "oct": round(statistics.mean(list(outgoing_syn_df["oct"])), 2),
            "ser": round(statistics.mean(list(outgoing_syn_df["ser"])), 2),
            "da": round(statistics.mean(list(outgoing_syn_df["da"])), 2),
        }

        # gets name of nt with highest value in dict #
        out_max = max(out_nt_avg_dict, key=out_nt_avg_dict.get)

        # adds max nt name to main list #
        out_max_list.append(out_max)

    # returns highest nt name if incoming info not requested #
    if incoming == False:
        # if only 1 id requested, returns result as str #
        if len(out_max_list) == 1:
            out_max = out_max_list[0]
            return out_max
        # if more than one id requested, returns result as list of str #
        else:
            return out_max_list

    # adds detailed info for incoming synapses if requested #
    else:
        out_max = out_max_list[0]
        root_id = root_ids[0]

        # sets column name for incoming synapses #
        incoming_col_name = "post_pt_root_id"

        # creates incoming synapse df by querying CAVE table #
        incoming_syn_df = client.materialize.query_table(
            synapse_table_name,
            filter_in_dict={incoming_col_name: [root_id]},
        )

        # removes synapses below cleft score threshold if greater than 0 #
        if cleft_score_thresh > 0:
            incoming_syn_df = incoming_syn_df[
                incoming_syn_df["cleft_score"] >= float(cleft_score_thresh)
            ].reset_index(drop=True)

        # makes dict of average nt scores #
        in_nt_avg_dict = {
            "ach": round(statistics.mean(list(incoming_syn_df["ach"])), 2),
            "da": round(statistics.mean(list(incoming_syn_df["da"])), 2),
            "gaba": round(statistics.mean(list(incoming_syn_df["gaba"])), 2),
            "glut": round(statistics.mean(list(incoming_syn_df["glut"])), 2),
            "oct": round(statistics.mean(list(incoming_syn_df["oct"])), 2),
            "ser": round(statistics.mean(list(incoming_syn_df["ser"])), 2),
        }

        # defines function for making violin plot of nt values #
        def make_nt_violin_plot(df):

            # rounds data to 2 decimal places #
            df = df.round(2)

            # creates blank figures #
            fig = go.Figure()

            # adds line data #
            fig.add_trace(
                go.Violin(
                    y=list(df["ach"]),
                    name="Ach",
                )
            )
            fig.add_trace(
                go.Violin(
                    y=list(df["da"]),
                    name="Da",
                )
            )
            fig.add_trace(
                go.Violin(
                    y=list(df["gaba"]),
                    name="Gaba",
                )
            )
            fig.add_trace(
                go.Violin(
                    y=list(df["glut"]),
                    name="Glut",
                )
            )
            fig.add_trace(
                go.Violin(
                    y=list(df["oct"]),
                    name="Oct",
                )
            )
            fig.add_trace(
                go.Violin(
                    y=list(df["ser"]),
                    name="Ser",
                )
            )

            # hides points #
            fig.update_traces(points=False)

            # fixes layout to minimize padding and fit two on one line #
            fig.update_layout(
                title="Incoming Synapse Neurotransmitters",
                margin={
                    "l": 5,
                    "r": 5,
                    "t": 25,
                    "b": 5,
                },
                width=400,
                height=200,
            )

            return fig

        # makes violin plot for neurotransmitters #
        in_fig = make_nt_violin_plot(incoming_syn_df)

        return [out_max, in_nt_avg_dict, in_fig]


def get_stack_data(datastack):
    """Get all the metadata for a specific CAVE datastack.

    Argument:
    datastack -- the name of the datastack you want information for, e.g. brain_and_nerve_cord (str)

    Returns:
    stack_info -- all the metadata on the requested datastack (dict)"""

    # sets client using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # pulls datastact info dictionary using stack name #
    stack_info = client.info.get_datastack_info()

    return stack_info


def get_stack_tables(datastack):
    """Get all the currently-listed tables for a specific CAVE datastack.

    Argument:
    datastack -- the name of the datastack you want information for, e.g. brain_and_nerve_cord (str)

    Returns:
    stack_tables -- names of all currently-documented tables for the requested datastack (list of str)
    """

    # sets client using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # pulls datastact info dictionary using stack name #
    stack_tables = client.annotation.get_tables()

    return stack_tables


def get_state_json_from_url(share_url, datastack):
    """Derive state JSON from shortened share link url.

    Arguments:
    share_url -- the shortened NG link you want th JSON for (str)
    datastack -- the name of the datastack the link is for, e.g. brain_and_nerve_cord (str)

    Returns:
    state_json -- the state JSON of the shortened link"""

    # sets client using datastack name #
    client = CAVEclient(datastack)

    # splits share url into components between slashes #
    split_url = share_url.split("/")

    # gets state ID, which is always last component #
    state_id = int(split_url[-1])

    # retreives JSON from state server using state ID #
    state_json = client.state.get_state_json(state_id)

    return state_json

def get_synapse_counts(root_ids, datastack, cleft_thresh=0):
    """Get synapse counts for a list of root IDs.
    
    Arguments:
    root_ids -- a list of root IDs to get synapse counts for (list of int or str, will also accept a single int or str)
    datastack -- the name of the datastack the IDs are from (str)
    cleft_thresh -- the cleft score bleow which to exclude synapses, currently only works with "flywire_fafb_production" datastack (int, default 0)
    
    Returns:
    synapse_dict -- a dictionary containing the requested synapse counts
    """

    # returns error if cleft thresholding is used with non-flywire datasets #
    if datastack != "flywire_fafb_production" and cleft_thresh != 0:
        raise ValueError("Cleft thresholding currently only works for the 'flywire_fafb_production' dataset.")

    ### CURRENTLY ASSUMES CLEFT SCORE COLUMN NAME IS "cleft_score", ONLY WORKS WITH FLYWIRE ###
    cleft_score_column_name = "cleft_score"

    # sets CAVE client object using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # gets metadata for chosen datastack as dict #
    stack_info = client.info.get_datastack_info()

    # gets name of synapse table using stack_info #
    synapse_table_name = stack_info["synapse_table"]

    # converts root IDs to list of integers for passing into query_table method #
    root_ids = list(map(int, root_ids))

    # creates empty synapse dict to fill with counts #
    synapse_dict = {}

    # iterates over root IDs to get synapse counts #
    for root_id in root_ids:
        in_df = client.materialize.query_table(
                synapse_table_name,
                filter_in_dict={"post_pt_root_id": [root_id]},
            )
        out_df = client.materialize.query_table(
                synapse_table_name,
                filter_in_dict={"pre_pt_root_id": [root_id]},
            )
        
        # drops synapses if asked #
        if cleft_thresh > 0:
            in_df = in_df[
                in_df[cleft_score_column_name] >= float(cleft_thresh)
            ].reset_index(drop=True)
            out_df = out_df[
                out_df[cleft_score_column_name] >= float(cleft_thresh)
            ].reset_index(drop=True)

        # gets synapse counts by counting length of dfs #
        incoming = len(in_df)
        outgoing = len(out_df)

        # adds values to synapse dict #
        synapse_dict[str(root_id)] = {
            "incoming" : incoming,
            "outgoing" : outgoing,
            "total" : incoming + outgoing,
        }
    
    return synapse_dict

def get_table(table_name, datastack):
    """Get the data as a pandas dataframe for a specific table in a specific CAVE datastack.

    Arguments:
    table_name -- the name of the table to request data for, e.g. cell_ids (str)
    datastack -- the name of the datastack you want information for, e.g. brain_and_nerve_cord (str)

    Returns:
    table_df -- the data for the requested table (pandas DataFrame)"""

    # sets client using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # pulls datastact info dictionary using stack name #
    table_df = client.materialize.query_table(table_name)

    return table_df


def get_table_data(table_name, datastack):
    """Get the metadata for a specific table in a specific CAVE datastack.

    Arguments:
    table_name -- the name of the table to request metadata for, e.g. cell_ids (str)
    datastack -- the name of the datastack you want information for, e.g. brain_and_nerve_cord (str)

    Returns:
    table_data -- all the metadata on the requested table (dict)"""

    # sets client using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # pulls datastact info dictionary using stack name #
    table_data = client.materialize.get_table_metadata(table_name)

    return table_data


def roots_to_nt_link(root_ids, datastack):
    """Generate a neuroglancer link from a list of root IDs color coded by dominant outgoing synapse neurotransmitter. CURRENTLY ONLY WORKS WITH FLYWIRE

    Arguments:
    root_ids -- a list of root IDs (list of int or str)
    datastack -- the name of the datastack the root IDs are from (str)

    Returns:
    link -- a neuroglancer url with nt-color-coded segments (str)
    """

    # gets dominant outgoing neurotransmitters for list of root IDs #
    nts = get_nt(root_ids, datastack)

    # creates empty list to fill with nt-paired hex values for color coding #
    color_list = []

    # adds hex values to color list based on dominant nt for each ID #
    for nt in nts:
        if nt == "ach":
            color_list.append("#ff4958")
        elif nt == "da":
            color_list.append("#ff944d")
        elif nt == "gaba":
            color_list.append("#e7d84a")
        elif nt == "glut":
            color_list.append("#44d44b")
        elif nt == "oct":
            color_list.append("#0084ff")
        elif nt == "ser":
            color_list.append("#b65eff")

    # builds neuroglancer link using root IDs and list of custom colors #
    link = build_ng_link(root_ids, datastack, custom_colors=color_list)

    return link


def root_to_svs(root_id, datastack):
    """Get root id using supervoxel id and dataset.

    Arguments:
    root_id -- the ID of the segment you want supervoxels for (str)
    datastack -- the name of the datastack the segment is in (str)

    Returns:
    sv_ids -- a list of all the supervoxel IDs that currently belong to the segment
    """

    # sets client using datastack name
    client = CAVEclient(datastack)

    # gets supervoxel IDs using root ID #
    sv_ids = list(client.chunkedgraph.get_leaves(root_id))

    return sv_ids


def root_to_vol(root_id, datastack):
    """Get the volume of a given root ID in cubic micrometers.

    Arguments:
    root_id -- the root ID of the neuron in question, e.g. 720575941471915328 (int)
    datastack -- the name of the datastack the root ID belongs to, e.g. brain_and_nerve_cord (str)

    Returns:
    vol -- the volume of the root ID requested in cubic nanometers"""

    # sets CAVE client using datastack name #
    client = CAVEclient(datastack_name=datastack)

    # gets all the supervoxel-level info about the root ID submitted #
    l2nodes = client.chunkedgraph.get_leaves(root_id, stop_layer=2)

    # pulls the volume data for all the supervoxels in l2nodes #
    l2stats = client.l2cache.get_l2data(l2nodes, attributes=["size_nm3"])

    # converts the l2stats into a dataframe #
    l2df = pd.DataFrame(l2stats).T

    # calculates the volume of the neuron by summing the nm3 volumes of its constituent supervoxels and dividing into um3 #
    vol = l2df.size_nm3.sum() / (1000 * 1000 * 1000)

    return vol


def stringify_int_list(int_list):
    """Convert all the integers in a list to strings.

    Arguments:
    int_list -- a list of integers, e.g. root IDs (list of ints)

    Returns:
    str_list -- the same list, with each item converted to a string (list of str)
    """
    str_list = map(str, int_list)
    return str_list


def sv_to_root(sv, datastack):
    """Get root id using supervoxel id and dataset.

    Arguments:
    sv -- the ID of the supervoxel (str)
    datastack -- the name of the datastack the supervoxel is in (str)

    Returns:
    root_id -- the root ID that supervoxel currently belongs to (str)
    """

    # sets client using datastack name
    client = CAVEclient(datastack)

    # looks up root ID using supervoxel ID #
    root_id = client.chunkedgraph.get_root_id(supervoxel_id=sv)

    return root_id


def visualize_skeletons(root_list, datastack="brain_and_nerve_cord"):
    """Generate a microviewer window using the submitted root IDs.

    Arguments:
    root_list -- a list of root IDs to visualize (list of ints)
    datastack -- the name of the datastack the root IDs come from (str, default 'brain_and_nerve_cord')
    """

    client = CAVEclient(datastack)

    matrix = np.array(
        [
            [16, 0, 0, 0],
            [0, 16, 0, 0],
            [0, 0, 45, 0],
        ],
        dtype=np.float32,
    )

    seconds = client.skeleton.generate_bulk_skeletons_async(
        root_list, skeleton_version=-1
    )

    if isinstance(seconds, dict):
        print("Bad root id.")
        sys.exit(0)

    print(f"ETA {seconds} seconds.")
    time.sleep(seconds)

    cskel_list = [client.skeleton.get_skeleton(i) for i in root_list]

    pskel_list = [
        Skeleton(
            vertices=c["vertices"],
            edges=c["edges"],
            radii=c["radius"],
            transform=matrix,
            space="physical",
        )
        for c in cskel_list
    ]

    viewer_list = pskel_list
    microviewer.objects(viewer_list)


def root_to_coords(root_ids, datastack, method="supervoxel"):
    """Convert root ID(s) to representative xyz coordinates.

    OPTIMIZED: Batches requests for fast processing of many IDs.

    Arguments:
    root_ids -- single root ID or list of root IDs (int, str, or list)
    datastack -- the name of the datastack (str)
    method -- "supervoxel" (fast, uses l2cache) or "skeleton" (slow, one-by-one) (str, default "supervoxel")

    Returns:
    coords_list -- list of [x, y, z] coordinates in viewer resolution, same order as input (list of lists)
    """

    # Handle single ID input
    if isinstance(root_ids, (int, str)):
        root_ids = [root_ids]

    # Convert all to int for API calls
    root_ids = [int(rid) for rid in root_ids]

    # Set up client
    client = CAVEclient(datastack_name=datastack)
    stack_info = client.info.get_datastack_info()
    viewer_res = [
        stack_info["viewer_resolution_x"],
        stack_info["viewer_resolution_y"],
        stack_info["viewer_resolution_z"],
    ]

    if method == "supervoxel":
        # FAST PATH: Batch process using l2cache
        print(f"  Fetching coordinates for {len(root_ids)} IDs (batched)...")

        # Get one L2 ID per root (batched by chunkedgraph internally)
        root_to_l2 = {}
        for i, root_id in enumerate(root_ids):
            try:
                l2_ids = client.chunkedgraph.get_leaves(root_id, stop_layer=2)
                if len(l2_ids) > 0:
                    root_to_l2[root_id] = l2_ids[0]
                if (i + 1) % 100 == 0:
                    print(f"    Progress: {i+1}/{len(root_ids)} IDs...")
            except Exception as e:
                print(f"    Warning: Could not get L2s for {root_id}: {e}")

        # Batch fetch all L2 coordinates in chunks (avoid server timeout)
        all_l2_ids = list(root_to_l2.values())
        print(f"  Fetching {len(all_l2_ids)} L2 coordinates (batched in chunks of 100)...")

        l2_data = {}
        chunk_size = 100
        for i in range(0, len(all_l2_ids), chunk_size):
            chunk = all_l2_ids[i:i + chunk_size]
            try:
                chunk_data = client.l2cache.get_l2data(chunk, attributes=["rep_coord_nm"])
                l2_data.update(chunk_data)
                if (i + chunk_size) % 200 == 0:
                    print(f"    Progress: {min(i + chunk_size, len(all_l2_ids))}/{len(all_l2_ids)} L2 IDs...")
            except Exception as e:
                print(f"    Warning: Could not fetch L2 chunk {i}-{i+chunk_size}: {e}")

        # Map back to original order
        coords_list = []
        for root_id in root_ids:
            if root_id in root_to_l2:
                l2_id = root_to_l2[root_id]
                # l2_data keys are strings, need to convert
                l2_key = str(l2_id)
                if l2_key in l2_data:
                    rep_coord = l2_data[l2_key].get("rep_coord_nm", [0, 0, 0])
                    coords = [int(rep_coord[i] / viewer_res[i]) for i in range(3)]
                    coords_list.append(coords)
                else:
                    coords_list.append(None)
            else:
                coords_list.append(None)

        return coords_list

    else:
        # SLOW PATH: Skeleton method (one-by-one, no batch API)
        print(f"  Warning: Skeleton method is slow for many IDs")
        coords_list = []

        for i, root_id in enumerate(root_ids):
            try:
                skeleton = client.skeleton.get_skeleton(root_id)
                vertices = np.array(skeleton["vertices"])
                centroid_nm = vertices.mean(axis=0)
                coords = [int(centroid_nm[i] / viewer_res[i]) for i in range(3)]
                coords_list.append(coords)

                if (i + 1) % 10 == 0:
                    print(f"    Progress: {i+1}/{len(root_ids)} IDs...")
            except Exception as e:
                print(f"    Warning: Could not get skeleton for {root_id}: {e}")
                coords_list.append(None)

        return coords_list


def update_root_ids(old_root_ids, datastack):
    """Update potentially outdated root IDs to their current versions.

    OPTIMIZED: Uses batch API calls for maximum speed.

    In connectomics databases, neurons get merged/split over time. This function
    takes old root IDs and returns their current equivalents by looking up
    supervoxels and finding their current parent root.

    Arguments:
    old_root_ids -- list of potentially outdated root IDs (list of int or str)
    datastack -- the name of the datastack (str)

    Returns:
    results -- list of dicts with keys: 'old_id', 'new_id', 'changed' (list of dicts)
               Returns in same order as input for easy side-by-side comparison
    """

    # Handle single ID input
    if isinstance(old_root_ids, (int, str)):
        old_root_ids = [old_root_ids]

    # Convert all to int
    old_root_ids = [int(rid) for rid in old_root_ids]

    # Set up client
    client = CAVEclient(datastack_name=datastack)

    print(f"  Checking {len(old_root_ids)} IDs for updates (via supervoxels, batched)...")

    # Use supervoxel method with batching: get supervoxels from old roots,
    # then batch lookup current roots for all supervoxels
    # This gives correct results when neurons are split/merged, with good performance

    # Step 1: Get one supervoxel from each old root ID
    id_to_sv = {}
    sv_list = []

    for i, old_id in enumerate(old_root_ids):
        try:
            sv_ids = client.chunkedgraph.get_leaves(old_id)
            if len(sv_ids) > 0:
                id_to_sv[old_id] = sv_ids[0]
                sv_list.append(sv_ids[0])
            else:
                id_to_sv[old_id] = None

            if (i + 1) % 100 == 0:
                print(f"    Getting supervoxels: {i+1}/{len(old_root_ids)}...")
        except Exception as e:
            print(f"    Warning: Could not get supervoxels for {old_id}: {e}")
            id_to_sv[old_id] = None

    # Step 2: Batch lookup current roots for all supervoxels at once
    print(f"  Looking up current roots for {len(sv_list)} supervoxels (batched)...")
    try:
        # Batch get roots for all supervoxels
        new_roots = client.chunkedgraph.get_roots(sv_list)

        # Build results mapping back to original IDs
        sv_to_root = {sv: root for sv, root in zip(sv_list, new_roots)}

        results = []
        for old_id in old_root_ids:
            sv = id_to_sv.get(old_id)
            if sv is not None and sv in sv_to_root:
                new_id = sv_to_root[sv]
                changed = (int(new_id) != int(old_id))
                results.append({
                    "old_id": str(old_id),
                    "new_id": str(new_id),
                    "changed": changed
                })
            else:
                results.append({
                    "old_id": str(old_id),
                    "new_id": None,
                    "changed": None
                })

        return results

    except Exception as e:
        print(f"    Error in batch root lookup: {e}")
        print(f"    Falling back to one-by-one method...")

        # Fallback: one-by-one if batch fails
        results = []
        for old_id in old_root_ids:
            sv = id_to_sv.get(old_id)
            if sv is not None:
                try:
                    new_id = client.chunkedgraph.get_root_id(supervoxel_id=sv)
                    changed = (int(new_id) != int(old_id))
                    results.append({
                        "old_id": str(old_id),
                        "new_id": str(new_id),
                        "changed": changed
                    })
                except Exception as e2:
                    print(f"    Warning: Could not update {old_id}: {e2}")
                    results.append({
                        "old_id": str(old_id),
                        "new_id": None,
                        "changed": None
                    })
            else:
                results.append({
                    "old_id": str(old_id),
                    "new_id": None,
                    "changed": None
                })

        return results


def root_ids_to_coords_table(root_ids, datastack, method="skeleton"):
    """Convert root IDs to coordinates and return as formatted table for pasting.

    Arguments:
    root_ids -- list of root IDs (list of int or str)
    datastack -- the name of the datastack (str)
    method -- "skeleton" or "supervoxel" (str, default "skeleton")

    Returns:
    table_str -- tab-separated string with ID and coords columns (str)
    """

    coords_list = root_to_coords(root_ids, datastack, method=method)

    lines = ["root_id\tx\ty\tz"]
    for rid, coords in zip(root_ids, coords_list):
        if coords:
            lines.append(f"{rid}\t{coords[0]}\t{coords[1]}\t{coords[2]}")
        else:
            lines.append(f"{rid}\tN/A\tN/A\tN/A")

    return "\n".join(lines)
